from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import Request
from fastapi import UploadFile
from fastapi import status

from flyt.apps.speech.schemas import SpeechTranscriptionResponse
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.clients import stt
from flyt.clients.exceptions import SttServiceNotConfiguredError
from flyt.clients.exceptions import SttServicePayloadError
from flyt.clients.exceptions import SttServiceResponseError
from flyt.clients.exceptions import SttServiceTransportError
from flyt.core.config import settings
from flyt.core.http import error_response

router = APIRouter(prefix="/speech", tags=["speech"])


def _speech_error(
    status_code: int,
    code: str,
    message: str,
    *,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=error_response(code, message),
        headers=headers,
    )


_UPSTREAM_ERRORS: dict[int, tuple[str, str]] = {
    status.HTTP_413_CONTENT_TOO_LARGE: (
        "SPEECH_AUDIO_TOO_LARGE",
        "Audio recording is too large.",
    ),
    status.HTTP_422_UNPROCESSABLE_CONTENT: (
        "SPEECH_AUDIO_INVALID",
        "Audio recording could not be processed.",
    ),
    status.HTTP_503_SERVICE_UNAVAILABLE: (
        "SPEECH_UNAVAILABLE",
        "Speech recognition is temporarily unavailable.",
    ),
}
_DEFAULT_UPSTREAM_ERROR = (
    status.HTTP_502_BAD_GATEWAY,
    "SPEECH_UPSTREAM_ERROR",
    "Speech recognition returned an unexpected response.",
)


def _upstream_error(error: SttServiceResponseError) -> HTTPException:
    if error.status_code in _UPSTREAM_ERRORS:
        code, message = _UPSTREAM_ERRORS[error.status_code]
        status_code = error.status_code
    else:
        status_code, code, message = _DEFAULT_UPSTREAM_ERROR
    if error.status_code == status.HTTP_503_SERVICE_UNAVAILABLE and error.retry_after:
        return _speech_error(
            status_code,
            code,
            message,
            headers={"Retry-After": error.retry_after},
        )
    return _speech_error(status_code, code, message)


async def _get_speech_user(
    request: Request,
    user: User = Depends(get_current_user),
) -> AsyncGenerator[User, None]:
    retry_after = await request.app.state.speech_rate_limiter.check(str(user.uuid))
    if retry_after is not None:
        raise _speech_error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "SPEECH_RATE_LIMITED",
            "Too many speech requests. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    admission = request.app.state.speech_proxy_admission
    if not admission.try_acquire():
        raise _speech_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SPEECH_UNAVAILABLE",
            "Speech recognition is temporarily unavailable.",
            headers={"Retry-After": "1"},
        )

    try:
        yield user
    finally:
        admission.release()


@router.post(
    "/transcribe",
    responses={
        429: {"description": "speech request rate limit exceeded"},
        413: {"description": "audio upload is too large"},
        422: {"description": "audio could not be processed"},
        502: {"description": "speech service returned an unexpected response"},
        503: {"description": "speech service is unavailable"},
    },
)
async def transcribe_speech(
    file: Annotated[UploadFile, File()],
    _current_user: Annotated[User, Depends(_get_speech_user)],
) -> SpeechTranscriptionResponse:
    try:
        payload = await file.read(settings.STT_MAX_AUDIO_BYTES + 1)
    finally:
        await file.close()

    if len(payload) > settings.STT_MAX_AUDIO_BYTES:
        raise _speech_error(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "SPEECH_AUDIO_TOO_LARGE",
            "Audio recording is too large.",
        )

    try:
        result = await stt.transcribe(
            payload,
            filename=file.filename or "recording.wav",
            content_type=file.content_type or "application/octet-stream",
        )
    except SttServiceResponseError as error:
        raise _upstream_error(error) from error
    except (SttServiceNotConfiguredError, SttServiceTransportError) as error:
        raise _speech_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SPEECH_UNAVAILABLE",
            "Speech recognition is temporarily unavailable.",
        ) from error
    except SttServicePayloadError as error:
        raise _speech_error(
            status.HTTP_502_BAD_GATEWAY,
            "SPEECH_UPSTREAM_INVALID",
            "Speech recognition returned an invalid response.",
        ) from error

    return SpeechTranscriptionResponse.model_validate(result, from_attributes=True)
