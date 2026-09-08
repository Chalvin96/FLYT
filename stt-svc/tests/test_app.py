from __future__ import annotations

import asyncio
import io
import sys
import threading
import types
import wave
from dataclasses import dataclass, replace

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import (
    MULTIPART_OVERHEAD_BYTES,
    Segment,
    Settings,
    SpeechRecognizer,
    Transcription,
    create_app,
)
from exceptions import AudioDecodeError, AudioTooLongError


def test_settings_given_default_environment_expect_shared_four_worker_defaults(
    monkeypatch,
) -> None:
    for name in (
        "STT_INFERENCE_WORKERS",
        "STT_CPU_THREADS",
        "STT_MAX_CONCURRENCY",
        "STT_MAX_QUEUE",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings.from_env()

    assert settings.inference_workers == 4
    assert settings.cpu_threads == 1
    assert settings.max_concurrency == 4
    assert settings.max_queue == 16


def test_settings_given_worker_environment_expect_overrides(monkeypatch) -> None:
    monkeypatch.setenv("STT_INFERENCE_WORKERS", "2")
    monkeypatch.setenv("STT_CPU_THREADS", "3")
    monkeypatch.setenv("STT_MAX_CONCURRENCY", "2")
    monkeypatch.setenv("STT_MAX_QUEUE", "7")

    settings = Settings.from_env()

    assert settings.inference_workers == 2
    assert settings.cpu_threads == 3
    assert settings.max_concurrency == 2
    assert settings.max_queue == 7

    monkeypatch.setenv("STT_MAX_QUEUE", "invalid")
    assert Settings.from_env().max_queue == 16
    monkeypatch.setenv("STT_MAX_QUEUE", "-1")
    assert Settings.from_env().max_queue == 0


def test_model_load_given_worker_settings_expect_model_receives_them(monkeypatch) -> None:
    calls: dict[str, object] = {}

    class FakeWhisperModel:
        def __init__(self, model_path: str, **kwargs: object) -> None:
            calls["model_path"] = model_path
            calls.update(kwargs)

    fake_faster_whisper = types.ModuleType("faster_whisper")
    fake_faster_whisper.WhisperModel = FakeWhisperModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "faster_whisper", fake_faster_whisper)

    settings = replace(
        Settings.from_env(),
        inference_workers=2,
        cpu_threads=3,
    )
    recognizer = SpeechRecognizer(settings)
    recognizer.load()

    assert recognizer.ready
    assert calls["num_workers"] == 2
    assert calls["cpu_threads"] == 3


def test_transcribe_given_compressed_audio_over_duration_expect_decode_stops_early() -> None:
    settings = replace(Settings.from_env(), max_audio_seconds=0.1)
    recognizer = SpeechRecognizer(settings)
    recognizer._model = object()
    payload = io.BytesIO()
    with wave.open(payload, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b"\0\0" * 3200)

    with pytest.raises(AudioTooLongError):
        recognizer.transcribe(payload.getvalue())


def test_app_given_default_concurrency_expect_four_inference_slots() -> None:
    settings = replace(Settings.from_env(), max_concurrency=4, max_queue=16)
    app = create_app(recognizer=FakeRecognizer(), settings=settings)

    assert app.state.inference_slots._value == 4
    assert app.state.admission.capacity == 20
    assert app.state.admission.admitted == 0


@dataclass
class FakeRecognizer:
    ready: bool = True
    failure: Exception | None = None
    calls: int = 0

    def load(self) -> None:
        pass

    def transcribe(self, payload: bytes) -> Transcription:
        self.calls += 1
        if self.failure:
            raise self.failure
        return Transcription(
            text="Dette er en test.",
            language="no",
            language_probability=0.99,
            duration_seconds=1.25,
            segments=[Segment(start=0, end=1.25, text="Dette er en test.")],
        )


class BlockingRecognizer(FakeRecognizer):
    def __init__(self) -> None:
        super().__init__()
        self.started = threading.Event()
        self.release = threading.Event()

    def transcribe(self, payload: bytes) -> Transcription:
        self.calls += 1
        self.started.set()
        self.release.wait(timeout=2)
        return Transcription(
            text="Dette er en test.",
            language="no",
            language_probability=0.99,
            duration_seconds=1.25,
            segments=[Segment(start=0, end=1.25, text="Dette er en test.")],
        )


def _client(
    recognizer: FakeRecognizer,
    *,
    settings: Settings | None = None,
    raise_server_exceptions: bool = True,
) -> TestClient:
    return TestClient(
        create_app(recognizer=recognizer, settings=settings),
        raise_server_exceptions=raise_server_exceptions,
    )


def test_live_health_given_process_is_running_expect_ok() -> None:
    with _client(FakeRecognizer(ready=False)) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_health_given_model_is_not_loaded_expect_service_unavailable() -> None:
    with _client(FakeRecognizer(ready=False)) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "speech model is not ready"


def test_ready_health_given_model_is_loaded_expect_ok() -> None:
    with _client(FakeRecognizer()) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_transcribe_given_valid_audio_expect_structured_norwegian_response() -> None:
    recognizer = FakeRecognizer()
    with _client(recognizer) as client:
        response = client.post(
            "/transcribe",
            files={"file": ("sample.wav", b"audio", "audio/wav")},
        )

    assert response.status_code == 200
    assert response.json() == {
        "text": "Dette er en test.",
        "language": "no",
        "language_probability": 0.99,
        "duration_seconds": 1.25,
        "segments": [{"start": 0.0, "end": 1.25, "text": "Dette er en test."}],
    }
    assert recognizer.calls == 1


def test_transcribe_given_model_is_not_ready_expect_service_unavailable() -> None:
    recognizer = FakeRecognizer(ready=False)
    with _client(recognizer) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 503
    assert recognizer.calls == 0


def test_transcribe_given_oversized_upload_expect_payload_too_large() -> None:
    recognizer = FakeRecognizer()
    settings = Settings.from_env()
    settings = Settings(
        **{**settings.__dict__, "max_audio_bytes": 3},
    )
    app = create_app(recognizer=recognizer, settings=settings)
    with TestClient(app) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 413
    assert recognizer.calls == 0
    assert app.state.admission.admitted == 0


def test_transcribe_given_chunked_body_exceeds_limit_expect_payload_too_large() -> None:
    recognizer = FakeRecognizer()
    settings = Settings.from_env()
    settings = Settings(**{**settings.__dict__, "max_audio_bytes": 3})
    app = create_app(recognizer=recognizer, settings=settings)
    boundary = "test-boundary"
    prefix = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; filename="sample.wav"\r\n'
        "Content-Type: audio/wav\r\n\r\n"
    ).encode()

    async def request() -> httpx.Response:
        async def body():
            yield prefix
            yield b"a" * (MULTIPART_OVERHEAD_BYTES + settings.max_audio_bytes)
            yield f"\r\n--{boundary}--\r\n".encode()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/transcribe",
                content=body(),
                headers={"content-type": f"multipart/form-data; boundary={boundary}"},
            )

    response = asyncio.run(request())

    assert response.status_code == 413
    assert recognizer.calls == 0


def test_transcribe_given_audio_cannot_be_decoded_expect_unprocessable_entity() -> None:
    recognizer = FakeRecognizer(failure=AudioDecodeError())
    with _client(recognizer) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 422
    assert response.json()["detail"] == "audio could not be decoded"


def test_transcribe_given_audio_is_too_long_expect_unprocessable_entity() -> None:
    recognizer = FakeRecognizer(failure=AudioTooLongError())
    with _client(recognizer) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 422
    assert response.json()["detail"] == "audio exceeds the maximum duration"


def test_transcribe_given_inference_slot_is_occupied_expect_service_unavailable() -> None:
    recognizer = FakeRecognizer()
    settings = Settings.from_env()
    settings = Settings(
        **{
            **settings.__dict__,
            "queue_timeout_seconds": 0.001,
        },
    )
    app = create_app(recognizer=recognizer, settings=settings)

    class BusySlot:
        async def acquire(self) -> None:
            await asyncio.sleep(1)

        def release(self) -> None:
            pass

    app.state.inference_slots = BusySlot()
    with TestClient(app) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 503
    assert response.headers["retry-after"] == "1"
    assert recognizer.calls == 0


def test_transcribe_given_admission_is_occupied_expect_upload_is_not_parsed(monkeypatch) -> None:
    recognizer = BlockingRecognizer()
    settings = replace(
        Settings.from_env(),
        max_concurrency=1,
        max_queue=0,
        queue_timeout_seconds=0.05,
    )
    app = create_app(recognizer=recognizer, settings=settings)

    async def fail_form(_: Request):
        raise AssertionError("multipart form was parsed before admission")

    async def exercise() -> tuple[httpx.Response, httpx.Response]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            first_task = asyncio.create_task(
                client.post("/transcribe", files={"file": ("sample.wav", b"audio")})
            )
            assert await asyncio.to_thread(recognizer.started.wait, 1)
            monkeypatch.setattr(Request, "form", fail_form)
            second = await client.post(
                "/transcribe",
                files={"file": ("sample.wav", b"audio", "audio/wav")},
            )
            recognizer.release.set()
            return await first_task, second

    first, second = asyncio.run(exercise())

    assert first.status_code == 200
    assert second.status_code == 503
    assert second.headers["retry-after"] == "1"
    assert recognizer.calls == 1


def test_transcribe_given_admission_capacity_is_exhausted_expect_retryable_busy() -> None:
    recognizer = BlockingRecognizer()
    settings = replace(
        Settings.from_env(),
        max_concurrency=1,
        max_queue=1,
        queue_timeout_seconds=0.5,
    )
    app = create_app(recognizer=recognizer, settings=settings)

    async def exercise() -> tuple[httpx.Response, httpx.Response, httpx.Response]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            first_task = asyncio.create_task(
                client.post("/transcribe", files={"file": ("sample.wav", b"audio")})
            )
            assert await asyncio.to_thread(recognizer.started.wait, 1)

            second_task = asyncio.create_task(
                client.post("/transcribe", files={"file": ("sample.wav", b"audio")})
            )
            for _ in range(100):
                if app.state.admission.admitted == 2:
                    break
                await asyncio.sleep(0.001)
            else:
                raise AssertionError("second request did not enter the admission queue")

            third = await client.post(
                "/transcribe",
                files={"file": ("sample.wav", b"audio")},
            )
            recognizer.release.set()
            first, second = await asyncio.gather(first_task, second_task)
            return first, second, third

    first, second, third = asyncio.run(exercise())

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 503
    assert third.headers["retry-after"] == "1"
    assert recognizer.calls == 2


def test_transcribe_given_cancellation_expect_inference_slot_held_until_thread_finishes() -> None:
    recognizer = BlockingRecognizer()
    settings = replace(
        Settings.from_env(),
        max_concurrency=1,
        max_queue=0,
    )
    app = create_app(recognizer=recognizer, settings=settings)

    async def exercise() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            request_task = asyncio.create_task(
                client.post("/transcribe", files={"file": ("sample.wav", b"audio")})
            )
            assert await asyncio.to_thread(recognizer.started.wait, 1)
            request_task.cancel()
            await asyncio.sleep(0.01)
            request_task.cancel()
            await asyncio.sleep(0.01)
            assert not request_task.done()
            assert app.state.inference_slots._value == 0
            recognizer.release.set()
            with pytest.raises(asyncio.CancelledError):
                await request_task

    asyncio.run(exercise())
    assert app.state.inference_slots._value == 1
    assert app.state.admission.admitted == 0


def test_transcribe_given_inference_failure_expect_admission_is_released() -> None:
    recognizer = FakeRecognizer(failure=RuntimeError("failed"))
    settings = Settings.from_env()
    settings = Settings(
        **{
            **settings.__dict__,
            "max_concurrency": 1,
            "max_queue": 0,
        },
    )
    app = create_app(recognizer=recognizer, settings=settings)
    with TestClient(app, raise_server_exceptions=False) as client:
        first = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})
        second = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert first.status_code == 500
    assert second.status_code == 500
    assert app.state.admission.admitted == 0


def test_transcribe_given_unexpected_failure_expect_internal_server_error() -> None:
    recognizer = FakeRecognizer(failure=RuntimeError("secret implementation detail"))
    with _client(recognizer, raise_server_exceptions=False) as client:
        response = client.post("/transcribe", files={"file": ("sample.wav", b"audio")})

    assert response.status_code == 500
    assert response.json() == {"detail": "transcription failed"}
