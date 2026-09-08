import logging
import secrets
from contextlib import asynccontextmanager
from time import perf_counter

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST
from prometheus_client import generate_latest
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp
from starlette.types import Message
from starlette.types import Receive
from starlette.types import Scope
from starlette.types import Send

from flyt.apps.admin.setup import create_admin
from flyt.apps.chatbot.router import router as chatbot_router
from flyt.apps.extension.router import router as extension_router
from flyt.apps.chatgpt_link.router import router as chatgpt_link_router
from flyt.apps.flashcards.router import user_cards_router
from flyt.apps.flashcards.router import user_deck_router
from flyt.apps.health.router import router as health_router
from flyt.apps.lessons.router import lessons_router
from flyt.apps.lexicons.router import me_router as lexicons_me_router
from flyt.apps.lexicons.router import router as lexicons_router
from flyt.apps.reading.import_router import router as imports_router
from flyt.apps.story_generation.router import router as story_generation_router
from flyt.apps.reading.router import router as reading_router
from flyt.apps.speech.middleware import SPEECH_MULTIPART_OVERHEAD_BYTES
from flyt.apps.speech.middleware import SPEECH_RATE_LIMIT_NAMESPACE
from flyt.apps.speech.middleware import SpeechProxyAdmission
from flyt.apps.speech.middleware import SpeechRequestBodyLimitMiddleware
from flyt.apps.speech.router import router as speech_router
from flyt.apps.stats.router import router as stats_router
from flyt.apps.test_support.router import router as test_support_router
from flyt.apps.users.router import dev_router as users_dev_router
from flyt.apps.users.router import router as users_router
from flyt.core.config import settings
from flyt.core.logging import configure_logging
from flyt.core.observability import configure_sentry
from flyt.core.rate_limit import MovingWindowRateLimiter
from flyt.core.redis import close_redis
from flyt.core.http import error_response

# Runs after the app-module imports above; safe: no app module emits a log
# record at import time (verified).
configure_logging()

logger = logging.getLogger(__name__)
access_logger = logging.getLogger("flyt.access")

# Paths excluded from the flyt.access log line: /metrics is scrape traffic and
# /health/* are probe traffic that would otherwise dominate the access log.
ACCESS_LOG_SKIP_PREFIXES: tuple[str, ...] = ("/metrics", "/health/")


class AccessLogMiddleware:
    """Emit a structured access log line for every request.

    Implemented as a pure ASGI middleware (not ``BaseHTTPMiddleware``) so that
    unhandled exceptions propagate to Sentry/GlitchTip with their real type
    instead of being wrapped in ``ExceptionGroup("unhandled errors in a
    TaskGroup")`` by anyio's separate task group.

    Logged on both the success and exception paths so that unhandled 500s
    still produce a record. The ``correlation_id`` field is injected
    automatically by :class:`asgi_correlation_id.log_filters.CorrelationIdFilter`
    attached to the handler.

    Requests to ``/metrics`` and ``/health/*`` are excluded (scrape/probe
    noise).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            # Pass through lifespan and websocket connections unchanged.
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        path = request.url.path
        skipped = path.startswith(ACCESS_LOG_SKIP_PREFIXES)

        status_code = 500
        response_started = False
        t0 = perf_counter()

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                nonlocal status_code, response_started
                status_code = message["status"]
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            # Only force a 500 status when no response.start has been sent
            # yet. For streaming responses / mid-body client disconnects the
            # downstream app may have already sent a real status (e.g. 200)
            # before raising; in that case preserve the sent status so the
            # access log reflects reality instead of falsely recording 500.
            if not response_started:
                status_code = 500
            raise
        finally:
            if not skipped:
                duration_ms = round((perf_counter() - t0) * 1000, 3)
                access_logger.info(
                    "%s %s %s",
                    request.method,
                    path,
                    status_code,
                    extra={
                        "method": request.method,
                        "route_path": path,
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                        # user_id is set on request.state (scope["state"]) by
                        # get_current_user / get_optional_user in deps.py after
                        # the downstream app has run.
                        "user_id": getattr(request.state, "user_id", None),
                        "client_ip": request.client.host if request.client else None,
                        "http_version": scope.get("http_version"),
                        "scheme": scope.get("scheme"),
                    },
                )


def configure_metrics(app: FastAPI) -> None:
    """Instrument the app for Prometheus metrics and expose ``/metrics``.

    The endpoint is gated behind a bearer token (``METRICS_TOKEN``). When
    ``METRICS_ENABLED`` is false the route is absent entirely.
    """
    if not settings.METRICS_ENABLED:
        return

    # Exclude scrape/probe paths from the http_* metric series so they stay
    # consistent with the access-log skip list (and don't dominate samples).
    Instrumentator(excluded_handlers=["/metrics", "/health/.*"]).instrument(app)

    @app.get("/metrics")
    async def metrics(request: Request) -> Response:
        token = settings.METRICS_TOKEN
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response(
                    "UNAUTHORIZED",
                    "Invalid metrics token",
                ),
            )
        auth_header = request.headers.get("Authorization", "")
        provided = ""
        if auth_header.startswith("Bearer "):
            provided = auth_header[len("Bearer ") :]
        if not secrets.compare_digest(provided.encode("utf-8"), token.encode("utf-8")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_response("UNAUTHORIZED", "Invalid metrics token"),
            )
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )


EXERCISE_EVALUATION_RATE_LIMIT_NAMESPACE = "flyt:exercise_evaluation"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.speech_rate_limiter = MovingWindowRateLimiter.from_redis_url(
        settings.REDIS_URL,
        settings.STT_PROXY_MAX_REQUESTS_PER_USER,
        settings.STT_PROXY_RATE_WINDOW_SECONDS,
        namespace=SPEECH_RATE_LIMIT_NAMESPACE,
    )
    app.state.exercise_evaluation_rate_limiter = MovingWindowRateLimiter.from_redis_url(
        settings.REDIS_URL,
        settings.LESSON_WRITE_JUDGE_MAX_REQUESTS_PER_USER,
        settings.LESSON_WRITE_JUDGE_RATE_WINDOW_SECONDS,
        namespace=EXERCISE_EVALUATION_RATE_LIMIT_NAMESPACE,
    )
    try:
        yield
    finally:
        await close_redis()


# Initialise Sentry BEFORE the app is created so FastApiIntegration can wrap it.
configure_sentry()

app = FastAPI(lifespan=lifespan)

speech_admission = SpeechProxyAdmission(settings.STT_PROXY_MAX_CONCURRENCY)
app.state.speech_proxy_admission = speech_admission

app.add_middleware(
    SpeechRequestBodyLimitMiddleware,
    max_body_bytes=(settings.STT_MAX_AUDIO_BYTES + SPEECH_MULTIPART_OVERHEAD_BYTES),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.OAUTH_SESSION_SECRET,
    session_cookie="oauth_session",
    https_only=settings.ACCESS_COOKIE_SECURE,
    same_site="lax",
    max_age=600,
)

# Middleware order: last add_middleware = outermost.
# Effective nesting (outer -> inner): CorrelationIdMiddleware -> AccessLogMiddleware
# -> SessionMiddleware -> CORSMiddleware -> SpeechRequestBodyLimitMiddleware.
# AccessLogMiddleware is added before CorrelationIdMiddleware so the
# correlation-id context is set before the access log fires.
# CorrelationIdMiddleware is added last (outermost) so the id is available
# everywhere. Both are pure-ASGI middlewares: no BaseHTTPMiddleware remains in
# the request path, so unhandled exceptions reach Sentry with their real type
# instead of an anyio ExceptionGroup wrapper.
app.add_middleware(AccessLogMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.exception_handler(Exception)
def unexpected_exception_handler(request: Request, exc: Exception):
    logger.error(f"[unexpected_exception] {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": error_response("INTERNAL_ERROR", "Internal server error")},
    )


app.include_router(users_router)
app.include_router(lexicons_router)
app.include_router(lexicons_me_router)
app.include_router(lessons_router)
app.include_router(reading_router)
app.include_router(speech_router)
app.include_router(imports_router)
app.include_router(story_generation_router)
app.include_router(user_deck_router)
app.include_router(user_cards_router)
app.include_router(stats_router)
app.include_router(health_router)
app.include_router(chatgpt_link_router)
app.include_router(chatbot_router)
app.include_router(extension_router)

if settings.ENV == "development":
    app.include_router(users_dev_router)

if settings.ENV == "e2e" and settings.ENABLE_E2E_TEST_AUTH:
    app.include_router(test_support_router)

create_admin().mount_to(app)

configure_metrics(app)


@app.get("/")
async def root():
    return {"message": "Hello World"}
