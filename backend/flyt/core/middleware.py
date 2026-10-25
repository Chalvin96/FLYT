from urllib.parse import urlsplit

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp
from starlette.types import Message
from starlette.types import Receive
from starlette.types import Scope
from starlette.types import Send

from flyt.core.config import Settings
from flyt.core.http import error_response

K_MAX_API_BODY_BYTES = 64 * 1024 * 1024
K_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def set_security_headers(headers: MutableHeaders, config: Settings) -> None:
    headers["X-Content-Type-Options"] = "nosniff"
    headers["X-Frame-Options"] = "DENY"
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    if config.ENV == "production":
        headers["Strict-Transport-Security"] = "max-age=31536000"


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared_error = _find_content_length_error(Request(scope))
        if declared_error is not None:
            await declared_error(scope, receive, send)
            return

        buffer = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(buffer) + len(chunk) > K_MAX_API_BODY_BYTES:
                await _build_body_too_large_response()(scope, receive, send)
                return
            buffer.extend(chunk)
            if not message.get("more_body", False):
                break

        buffered_message: Message | None = {
            "type": "http.request",
            "body": bytes(buffer),
            "more_body": False,
        }
        del buffer

        async def replay_body() -> Message:
            nonlocal buffered_message
            if buffered_message is None:
                return await receive()
            message = buffered_message
            buffered_message = None
            return message

        await self.app(scope, replay_body, send)


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp, config: Settings) -> None:
        self.app = app
        self.config = config

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and not self._is_origin_allowed(Request(scope)):
            await JSONResponse(
                status_code=403,
                content={
                    "detail": error_response(
                        "ORIGIN_NOT_ALLOWED", "Request origin is not allowed."
                    )
                },
            )(scope, receive, send)
            return
        await self.app(scope, receive, send)

    def _is_origin_allowed(self, request: Request) -> bool:
        if request.method not in K_UNSAFE_METHODS:
            return True
        if not request.cookies.get(self.config.ACCESS_COOKIE_NAME):
            return True
        scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
        is_admin = request.url.path == "/admin" or request.url.path.startswith(
            "/admin/"
        )
        if scheme.lower() == "bearer" and credentials and not is_admin:
            return True
        origin = request.headers.get("origin")
        if origin is None:
            referer = request.headers.get("referer", "")
            try:
                parsed = urlsplit(referer)
                origin = (
                    f"{parsed.scheme}://{parsed.netloc}"
                    if parsed.scheme and parsed.netloc
                    else None
                )
            except ValueError:
                return False
        return origin in self.config.FRONTEND_ORIGINS


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, config: Settings) -> None:
        self.app = app
        self.config = config

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                set_security_headers(MutableHeaders(scope=message), self.config)
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


def _build_body_too_large_response() -> JSONResponse:
    return JSONResponse(
        status_code=413,
        content={
            "detail": error_response(
                "REQUEST_BODY_TOO_LARGE", "Request body is too large."
            )
        },
    )


def _find_content_length_error(request: Request) -> JSONResponse | None:
    content_length = request.headers.get("content-length")
    if content_length is None:
        return None
    try:
        size = int(content_length)
    except ValueError:
        size = -1
    if size < 0:
        return JSONResponse(
            status_code=400,
            content={
                "detail": error_response(
                    "INVALID_CONTENT_LENGTH", "Invalid Content-Length."
                )
            },
        )
    if size > K_MAX_API_BODY_BYTES:
        return _build_body_too_large_response()
    return None
