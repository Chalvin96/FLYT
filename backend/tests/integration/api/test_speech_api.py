from http import HTTPStatus

import pytest
from httpx import AsyncClient
from limits.aio.storage import MemoryStorage

from flyt.apps.speech import router as speech_router
from flyt.apps.speech.middleware import SPEECH_MULTIPART_OVERHEAD_BYTES
from flyt.apps.speech.middleware import SpeechProxyAdmission
from flyt.clients.exceptions import SttServiceResponseError
from flyt.clients.exceptions import SttServiceTransportError
from flyt.clients.stt import SttSegment
from flyt.clients.stt import SttTranscription
from flyt.core.config import settings
from flyt.core.rate_limit import MovingWindowRateLimiter
from flyt.main import app
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


def _transcription() -> SttTranscription:
    return SttTranscription(
        text="Dette er en test.",
        language="no",
        language_probability=0.99,
        duration_seconds=1.25,
        segments=(SttSegment(start=0, end=1.25, text="Dette er en test."),),
    )


async def test_transcribe_speech_given_no_session_expect_401(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json()["detail"]["code"] == "AUTHENTICATION_FAILED"


async def test_transcribe_speech_given_oversized_declared_body_expect_413_before_auth(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/speech/transcribe",
        content=b"audio",
        headers={
            "Origin": "http://localhost:5173",
            "Content-Length": str(
                settings.STT_MAX_AUDIO_BYTES + SPEECH_MULTIPART_OVERHEAD_BYTES + 1
            ),
        },
    )

    assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert response.json()["detail"]["code"] == "SPEECH_AUDIO_TOO_LARGE"
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


async def test_transcribe_speech_given_authenticated_upload_expect_forwarded_response(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    recorded: dict[str, object] = {}

    async def transcribe(
        audio: bytes,
        *,
        filename: str,
        content_type: str,
    ) -> SttTranscription:
        recorded.update(
            audio=audio,
            filename=filename,
            content_type=content_type,
        )
        return _transcription()

    monkeypatch.setattr(speech_router.stt, "transcribe", transcribe)

    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
    )

    assert response.status_code == HTTPStatus.OK
    assert recorded == {
        "audio": b"audio",
        "filename": "learner.webm",
        "content_type": "audio/webm",
    }
    assert response.json() == {
        "text": "Dette er en test.",
        "language": "no",
        "language_probability": 0.99,
        "duration_seconds": 1.25,
        "segments": [{"start": 0, "end": 1.25, "text": "Dette er en test."}],
    }


async def test_transcribe_speech_given_oversized_upload_expect_413_without_forwarding(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    monkeypatch.setattr(settings, "STT_MAX_AUDIO_BYTES", 3)
    forwarded = False

    async def transcribe(*args: object, **kwargs: object) -> SttTranscription:
        nonlocal forwarded
        forwarded = True
        return _transcription()

    monkeypatch.setattr(speech_router.stt, "transcribe", transcribe)

    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.wav", b"audio", "audio/wav")},
    )

    assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert response.json()["detail"]["code"] == "SPEECH_AUDIO_TOO_LARGE"
    assert forwarded is False


async def test_transcribe_speech_given_service_transport_failure_expect_503(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    async def transcribe(*args: object, **kwargs: object) -> SttTranscription:
        raise SttServiceTransportError("offline")

    monkeypatch.setattr(speech_router.stt, "transcribe", transcribe)

    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.wav", b"audio", "audio/wav")},
    )

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json()["detail"] == {
        "code": "SPEECH_UNAVAILABLE",
        "message": "Speech recognition is temporarily unavailable.",
        "error": None,
    }


async def test_transcribe_speech_given_full_backend_admission_expect_retryable_503(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    admission = app.state.speech_proxy_admission
    assert isinstance(admission, SpeechProxyAdmission)
    monkeypatch.setattr(admission, "capacity", 0)

    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.headers["Retry-After"] == "1"
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.json()["detail"]["code"] == "SPEECH_UNAVAILABLE"


async def test_transcribe_speech_given_user_rate_window_exhausted_expect_429(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    single_request_limiter = MovingWindowRateLimiter(
        MemoryStorage(),
        max_requests=1,
        window_seconds=settings.STT_PROXY_RATE_WINDOW_SECONDS,
    )
    monkeypatch.setattr(app.state, "speech_rate_limiter", single_request_limiter)

    async def transcribe(*args: object, **kwargs: object) -> SttTranscription:
        return _transcription()

    monkeypatch.setattr(speech_router.stt, "transcribe", transcribe)

    first = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
    )
    second = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
    )

    assert first.status_code == HTTPStatus.OK
    assert second.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert int(second.headers["Retry-After"]) > 0
    assert second.json()["detail"]["code"] == "SPEECH_RATE_LIMITED"


async def test_transcribe_speech_given_upstream_retry_hint_expect_forwarded_503(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    async def transcribe(*args: object, **kwargs: object) -> SttTranscription:
        raise SttServiceResponseError(503, retry_after="4")

    monkeypatch.setattr(speech_router.stt, "transcribe", transcribe)

    response = await client.post(
        "/speech/transcribe",
        files={"file": ("learner.webm", b"audio", "audio/webm")},
        headers={"Origin": "http://localhost:5173"},
    )

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.headers["Retry-After"] == "4"
    assert "Retry-After" in response.headers["access-control-expose-headers"]
    assert response.json()["detail"]["code"] == "SPEECH_UNAVAILABLE"
