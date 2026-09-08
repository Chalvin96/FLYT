import logging

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp
from starlette.types import Message
from starlette.types import Receive
from starlette.types import Scope
from starlette.types import Send

from flyt.core.http import error_response

SPEECH_TRANSCRIBE_PATH = "/speech/transcribe"
SPEECH_MULTIPART_OVERHEAD_BYTES = 64 * 1024
SPEECH_RATE_LIMIT_NAMESPACE = "flyt:speech"

logger = logging.getLogger(__name__)


class _RequestBodyTooLarge(Exception):
    pass


def _is_speech_transcription(scope: Scope) -> bool:
    if scope.get("type") != "http" or scope.get("method") != "POST":
        return False
    path = str(scope.get("path", "")).rstrip("/") or "/"
    return path == SPEECH_TRANSCRIBE_PATH


def _content_length(scope: Scope) -> int | None:
    for name, value in scope.get("headers", []):
        if name.lower() != b"content-length":
            continue
        try:
            length = int(value)
        except (TypeError, ValueError):
            return None
        return length if length >= 0 else None
    return None


async def _send_error(
    scope: Scope,
    receive: Receive,
    send: Send,
    *,
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
) -> None:
    response = JSONResponse(
        status_code=status_code,
        content={"detail": error_response(code, message)},
        headers=headers,
    )
    await response(scope, receive, send)


class SpeechRequestBodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max(1, max_body_bytes)

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if not _is_speech_transcription(scope):
            await self.app(scope, receive, send)
            return

        declared_length = _content_length(scope)
        if declared_length is not None and declared_length > self.max_body_bytes:
            await _send_error(
                scope,
                receive,
                send,
                status_code=413,
                code="SPEECH_AUDIO_TOO_LARGE",
                message="Audio recording is too large.",
            )
            return

        received_bytes = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received_bytes
            message = await receive()
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > self.max_body_bytes:
                    raise _RequestBodyTooLarge
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except _RequestBodyTooLarge:
            if response_started:
                raise
            await _send_error(
                scope,
                receive,
                send,
                status_code=413,
                code="SPEECH_AUDIO_TOO_LARGE",
                message="Audio recording is too large.",
            )


class SpeechProxyAdmission:
    def __init__(self, capacity: int) -> None:
        self.capacity = max(1, capacity)
        self._admitted = 0

    def try_acquire(self) -> bool:
        if self._admitted >= self.capacity:
            return False
        self._admitted += 1
        return True

    def release(self) -> None:
        self._admitted = max(0, self._admitted - 1)
