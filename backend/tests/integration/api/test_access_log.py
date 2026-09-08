"""Integration tests for the ``flyt.access`` structured access-log middleware.

Hits real routes through the shared ``client`` fixture (no SQLAlchemy mocking)
and asserts that the access-log record carries the expected structured fields,
including ``user_id`` on authenticated requests and ``status_code`` 500 on the
unhandled-exception path.
"""

import logging
from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest
from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from httpx import ASGITransport
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.services import AuthService
from flyt.main import AccessLogMiddleware
from tests.factories import LemmaFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


async def test_access_log_given_request_expect_duration_and_status_fields(
    client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # /health/* is excluded from the access log, so hit "/" instead.
    with caplog.at_level(logging.INFO, logger="flyt.access"):
        response = await client.get("/")

    assert response.status_code == HTTPStatus.OK

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 1
    record = access_records[0]
    assert record.levelno == logging.INFO
    assert record.method == "GET"
    assert record.route_path == "/"
    assert record.status_code == HTTPStatus.OK
    assert isinstance(record.duration_ms, float | int)
    assert record.duration_ms >= 0
    assert hasattr(record, "client_ip")
    assert hasattr(record, "http_version")
    assert hasattr(record, "scheme")


async def test_access_log_given_authenticated_request_expect_user_id(
    client: AsyncClient,
    db: AsyncSession,
    caplog: pytest.LogCaptureFixture,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    token = AuthService().create_access_token(data={"sub": str(user.uuid)})

    with caplog.at_level(logging.INFO, logger="flyt.access"):
        response = await client.post(
            f"/lexicons/lemmas/{lemma.uuid}/mark-known",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == HTTPStatus.OK

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 1
    record = access_records[0]
    assert record.user_id == str(user.uuid)


async def test_access_log_given_unhandled_exception_expect_status_500(
    caplog: pytest.LogCaptureFixture,
) -> None:
    app = FastAPI()
    # Same middleware order as flyt.main: AccessLogMiddleware first (inner),
    # CorrelationIdMiddleware last (outer).
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(CorrelationIdMiddleware)

    @app.get("/boom")
    async def _boom() -> None:
        msg = "kaboom"
        raise RuntimeError(msg)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        with caplog.at_level(logging.INFO, logger="flyt.access"):
            # Starlette's ServerErrorMiddleware re-raises after handling, so the
            # exception propagates through the ASGI transport. The assertion that
            # matters is the logged access record, not the client response.
            with pytest.raises(RuntimeError, match="kaboom"):
                await ac.get("/boom")

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 1
    record = access_records[0]
    assert record.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert record.method == "GET"
    assert record.route_path == "/boom"


async def test_access_log_given_exception_after_response_start_expect_sent_status_not_500(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Regression: streaming response that raises after the first chunk.

    The downstream app sends ``http.response.start`` with status 200, yields
    one body chunk, then raises. The middleware must record the real sent
    status (200), NOT overwrite it with 500: the failure happened after the
    status was already on the wire.
    """
    app = FastAPI()
    # Same middleware order as flyt.main: AccessLogMiddleware first (inner),
    # CorrelationIdMiddleware last (outer).
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(CorrelationIdMiddleware)

    async def boom_streamer() -> AsyncIterator[bytes]:
        yield b"first chunk"
        msg = "stream blew up"
        raise RuntimeError(msg)

    @app.get("/stream-boom")
    async def _stream_boom() -> StreamingResponse:
        return StreamingResponse(boom_streamer(), status_code=200)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        with caplog.at_level(logging.INFO, logger="flyt.access"):
            # StreamingResponse starts the response (200), yields one chunk,
            # then the generator raises. Starlette re-raises after handling
            # so the exception propagates through the ASGI transport. The
            # assertion that matters is the logged access record.
            with pytest.raises(RuntimeError, match="stream blew up"):
                await ac.get("/stream-boom")

    access_records = [r for r in caplog.records if r.name == "flyt.access"]
    assert len(access_records) == 1
    record = access_records[0]
    assert record.status_code == HTTPStatus.OK
    assert record.method == "GET"
    assert record.route_path == "/stream-boom"
