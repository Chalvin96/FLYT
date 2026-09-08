from __future__ import annotations

import asyncio
import io
import logging
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.types import ASGIApp, Receive, Scope, Send

from exceptions import AudioDecodeError, AudioTooLongError, ModelNotReadyError

logger = logging.getLogger("flyt.stt")
MULTIPART_OVERHEAD_BYTES = 64 * 1024


class RequestBodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    @staticmethod
    def _content_length(scope: Scope) -> int | None:
        for name, value in scope.get("headers", []):
            if name.lower() != b"content-length":
                continue
            try:
                return max(0, int(value))
            except ValueError:
                return None
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = self._content_length(scope)
        if content_length is not None and content_length > self.max_bytes:
            response = JSONResponse(
                status_code=413,
                content={"detail": "audio upload is too large"},
            )
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> dict:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail="audio upload is too large",
                    )
            return message

        await self.app(scope, limited_receive, send)


class RequestAdmission:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self._admitted = 0

    @property
    def admitted(self) -> int:
        return self._admitted

    def acquire(self) -> bool:
        if self._admitted >= self.capacity:
            return False
        self._admitted += 1
        return True

    def release(self) -> None:
        if self._admitted <= 0:
            raise RuntimeError("speech admission released without a reservation")
        self._admitted -= 1


class RequestAdmissionMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        admission: RequestAdmission,
    ) -> None:
        self.app = app
        self.admission = admission

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or scope["path"] != "/transcribe":
            await self.app(scope, receive, send)
            return

        if not self.admission.acquire():
            response = JSONResponse(
                status_code=503,
                content={"detail": "speech service is busy; retry shortly"},
                headers={"Retry-After": "1"},
            )
            await response(scope, receive, send)
            return

        try:
            await self.app(scope, receive, send)
        finally:
            self.admission.release()


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return max(minimum, int(value))
    except ValueError:
        logger.warning("Ignoring invalid integer setting %s=%r", name, value)
        return default


def _env_float(name: str, default: float, *, minimum: float = 0.0) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return max(minimum, float(value))
    except ValueError:
        logger.warning("Ignoring invalid float setting %s=%r", name, value)
        return default


@dataclass(frozen=True)
class Settings:
    model_path: Path
    model_revision: str
    inference_workers: int
    cpu_threads: int
    beam_size: int
    max_audio_bytes: int
    max_audio_seconds: float
    max_concurrency: int
    max_queue: int
    queue_timeout_seconds: float
    vad_min_silence_duration_ms: int

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            model_path=Path(os.getenv("STT_MODEL_PATH", "/models/nb-whisper-medium-int8")),
            model_revision=os.getenv(
                "STT_MODEL_REVISION",
                "0ed074d5985bd56ca4140159a9dbffbc3fb5117e",
            ),
            inference_workers=_env_int("STT_INFERENCE_WORKERS", 4),
            cpu_threads=_env_int("STT_CPU_THREADS", 1),
            beam_size=_env_int("STT_BEAM_SIZE", 5),
            max_audio_bytes=_env_int("STT_MAX_AUDIO_BYTES", 10 * 1024 * 1024),
            max_audio_seconds=_env_float("STT_MAX_AUDIO_SECONDS", 20.0, minimum=0.1),
            max_concurrency=_env_int("STT_MAX_CONCURRENCY", 4),
            max_queue=_env_int("STT_MAX_QUEUE", 16, minimum=0),
            queue_timeout_seconds=_env_float("STT_QUEUE_TIMEOUT_SECONDS", 0.25, minimum=0.0),
            vad_min_silence_duration_ms=_env_int("STT_VAD_MIN_SILENCE_MS", 500),
        )


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class Transcription:
    text: str
    language: str
    language_probability: float
    duration_seconds: float
    segments: list[Segment]


class Recognizer(Protocol):
    @property
    def ready(self) -> bool: ...

    def load(self) -> None: ...

    def transcribe(self, payload: bytes) -> Transcription: ...


class SpeechRecognizer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model: Any | None = None

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        try:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(
                str(self.settings.model_path),
                device="cpu",
                compute_type="int8",
                cpu_threads=self.settings.cpu_threads,
                num_workers=self.settings.inference_workers,
            )
            logger.info(
                "Loaded NB-Whisper Medium revision %s from %s using %d inference "
                "workers and %d CPU threads each",
                self.settings.model_revision,
                self.settings.model_path,
                self.settings.inference_workers,
                self.settings.cpu_threads,
            )
        except Exception:
            self._model = None
            logger.exception("Could not load speech model from %s", self.settings.model_path)

    def transcribe(self, payload: bytes) -> Transcription:
        if self._model is None:
            raise ModelNotReadyError

        try:
            audio = self._bounded_audio(payload, self.settings.max_audio_seconds)
        except AudioTooLongError:
            raise
        except Exception as exc:
            raise AudioDecodeError from exc

        duration_seconds = len(audio) / 16000
        if duration_seconds <= 0:
            raise AudioDecodeError
        if duration_seconds > self.settings.max_audio_seconds:
            raise AudioTooLongError

        try:
            segments, info = self._model.transcribe(
                audio,
                language="no",
                task="transcribe",
                beam_size=self.settings.beam_size,
                temperature=0.0,
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters={
                    "min_silence_duration_ms": self.settings.vad_min_silence_duration_ms
                },
            )
            parsed_segments = [
                Segment(
                    start=float(segment.start),
                    end=float(segment.end),
                    text=segment.text.strip(),
                )
                for segment in segments
                if segment.text.strip()
            ]
        except Exception:
            logger.exception("Speech model inference failed")
            raise

        text = " ".join(segment.text for segment in parsed_segments)
        language_probability = float(getattr(info, "language_probability", 0.0) or 0.0)
        info_duration = float(getattr(info, "duration", duration_seconds) or duration_seconds)
        return Transcription(
            text=text,
            language="no",
            language_probability=language_probability,
            duration_seconds=info_duration,
            segments=parsed_segments,
        )

    @staticmethod
    def _bounded_audio(payload: bytes, max_audio_seconds: float):
        import av
        import numpy as np

        sampling_rate = 16000
        max_samples = int(max_audio_seconds * sampling_rate)
        chunks = []
        sample_count = 0
        resampler = av.audio.resampler.AudioResampler(
            format="s16",
            layout="mono",
            rate=sampling_rate,
        )

        with av.open(io.BytesIO(payload), mode="r", metadata_errors="ignore") as container:
            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    chunk = resampled.to_ndarray().reshape(-1)
                    sample_count += len(chunk)
                    if sample_count > max_samples:
                        raise AudioTooLongError
                    chunks.append(chunk)

            for resampled in resampler.resample(None):
                chunk = resampled.to_ndarray().reshape(-1)
                sample_count += len(chunk)
                if sample_count > max_samples:
                    raise AudioTooLongError
                chunks.append(chunk)

        if not chunks:
            raise AudioDecodeError
        return np.concatenate(chunks).astype(np.float32) / 32768.0


class SegmentResponse(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    language_probability: float = Field(ge=0, le=1)
    duration_seconds: float = Field(ge=0)
    segments: list[SegmentResponse]


class HealthResponse(BaseModel):
    status: str


def _response(transcription: Transcription) -> TranscriptionResponse:
    return TranscriptionResponse(
        text=transcription.text,
        language=transcription.language,
        language_probability=transcription.language_probability,
        duration_seconds=transcription.duration_seconds,
        segments=[
            SegmentResponse(start=segment.start, end=segment.end, text=segment.text)
            for segment in transcription.segments
        ],
    )


def create_app(
    recognizer: Recognizer | None = None,
    settings: Settings | None = None,
) -> FastAPI:
    service_settings = settings or Settings.from_env()
    service_recognizer = recognizer or SpeechRecognizer(service_settings)
    load_model_on_startup = recognizer is None

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        service_recognizer.load()
        if load_model_on_startup and not service_recognizer.ready:
            raise RuntimeError("speech model failed to load")
        yield

    app = FastAPI(title="Flyt CPU STT service", lifespan=lifespan)
    admission = RequestAdmission(service_settings.max_concurrency + service_settings.max_queue)
    app.add_middleware(
        RequestAdmissionMiddleware,
        admission=admission,
    )
    app.add_middleware(
        RequestBodySizeLimitMiddleware,
        max_bytes=service_settings.max_audio_bytes + MULTIPART_OVERHEAD_BYTES,
    )
    app.state.settings = service_settings
    app.state.recognizer = service_recognizer
    app.state.admission = admission
    app.state.inference_slots = asyncio.Semaphore(service_settings.max_concurrency)

    async def acquire_slot(slot: asyncio.Semaphore) -> None:
        try:
            await asyncio.wait_for(
                slot.acquire(),
                timeout=service_settings.queue_timeout_seconds,
            )
        except TimeoutError:
            raise HTTPException(
                status_code=503,
                detail="speech service is busy; retry shortly",
                headers={"Retry-After": "1"},
            ) from None

    async def run_inference(payload: bytes) -> Transcription:
        task = asyncio.create_task(asyncio.to_thread(service_recognizer.transcribe, payload))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            while not task.done():
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    pass
                except BaseException:
                    break
            raise

    @app.get("/health/live", response_model=HealthResponse)
    async def live() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get("/health/ready", response_model=HealthResponse, responses={503: {"model": dict}})
    async def ready() -> HealthResponse:
        if not service_recognizer.ready:
            raise HTTPException(status_code=503, detail="speech model is not ready")
        return HealthResponse(status="ready")

    @app.post(
        "/transcribe",
        response_model=TranscriptionResponse,
        responses={
            413: {"description": "audio upload is too large"},
            503: {"description": "speech service is busy or not ready"},
        },
    )
    async def transcribe(file: UploadFile) -> TranscriptionResponse:
        if not service_recognizer.ready:
            raise HTTPException(status_code=503, detail="speech model is not ready")

        inference_acquired = False
        try:
            payload = await file.read(service_settings.max_audio_bytes + 1)
        finally:
            await file.close()

        if len(payload) > service_settings.max_audio_bytes:
            raise HTTPException(status_code=413, detail="audio upload is too large")

        try:
            await acquire_slot(app.state.inference_slots)
            inference_acquired = True

            result = await run_inference(payload)
        except ModelNotReadyError:
            raise HTTPException(status_code=503, detail="speech model is not ready") from None
        except AudioDecodeError:
            raise HTTPException(status_code=422, detail="audio could not be decoded") from None
        except AudioTooLongError:
            raise HTTPException(
                status_code=422,
                detail="audio exceeds the maximum duration",
            ) from None
        except HTTPException:
            raise
        except Exception:
            logger.exception("Unexpected transcription request failure")
            raise HTTPException(status_code=500, detail="transcription failed") from None
        finally:
            if inference_acquired:
                app.state.inference_slots.release()

        return _response(result)

    return app


app = create_app()
