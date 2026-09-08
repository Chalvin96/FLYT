from collections.abc import AsyncGenerator
from http import HTTPStatus
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport
from httpx import AsyncClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.health.router import router as health_router
from flyt.core.db import get_async_db

pytestmark = pytest.mark.anyio


async def test_live_given_no_dependencies_expect_ok(client: AsyncClient) -> None:
    response = await client.get("/health/live")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"status": "ok"}


async def test_ready_given_db_reachable_expect_ok(client: AsyncClient) -> None:
    response = await client.get("/health/ready")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["status"] == "ok"
    assert response.json()["checks"]["database"] == "ok"


async def test_ready_given_db_unreachable_expect_503() -> None:
    # Intentionally mocks the session (deviates from testing.md "never mock
    # SQLAlchemy"): this exercises the DB-unreachable branch, an infra failure
    # a real Postgres connection can't cheaply simulate mid-request.
    app = FastAPI()
    app.include_router(health_router)

    mock_session = AsyncMock()
    mock_session.execute.side_effect = OperationalError("boom", None, Exception("boom"))

    async def _override_async_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_async_db] = _override_async_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/health/ready")
    finally:
        app.dependency_overrides.pop(get_async_db, None)

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json()["status"] == "error"
    assert response.json()["checks"]["database"] == "error"
    mock_session.execute.assert_awaited_once()
