from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from http import HTTPStatus

import pytest
from fastapi import FastAPI
from httpx import ASGITransport
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.test_support.router import router as test_support_router
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserSettings
from flyt.core.config import settings
from flyt.core.db import get_async_db

pytestmark = pytest.mark.anyio


@asynccontextmanager
async def build_test_client(
    db: AsyncSession,
) -> AsyncGenerator[AsyncClient, None]:
    app = FastAPI()
    app.include_router(test_support_router)

    async def _override_async_db() -> AsyncGenerator[AsyncSession, None]:
        yield db

    app.dependency_overrides[get_async_db] = _override_async_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_async_db, None)


async def test_test_login_given_e2e_enabled_expect_cookie_and_user_created(
    db: AsyncSession,
) -> None:
    original = (
        settings.ENV,
        settings.ENABLE_E2E_TEST_AUTH,
        settings.ACCESS_COOKIE_SECURE,
    )
    settings.ENV = "e2e"
    settings.ENABLE_E2E_TEST_AUTH = True
    settings.ACCESS_COOKIE_SECURE = False

    try:
        async with build_test_client(db) as client:
            response = await client.post(
                "/test/login",
                json={"email": "review-rating@example.com"},
            )
    finally:
        (
            settings.ENV,
            settings.ENABLE_E2E_TEST_AUTH,
            settings.ACCESS_COOKIE_SECURE,
        ) = original

    assert response.status_code == HTTPStatus.OK
    assert response.cookies.get(settings.ACCESS_COOKIE_NAME)

    user = await db.scalar(
        select(User).where(User.email == "review-rating@example.com")
    )
    assert user is not None

    identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.user_id == user.id,
            AuthIdentity.provider == "e2e",
            AuthIdentity.provider_subject == "review-rating@example.com",
        )
    )
    assert identity is not None

    user_settings = await db.scalar(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    assert user_settings is not None


async def test_test_login_given_e2e_disabled_expect_not_found(
    db: AsyncSession,
) -> None:
    original = (
        settings.ENV,
        settings.ENABLE_E2E_TEST_AUTH,
        settings.ACCESS_COOKIE_SECURE,
    )
    settings.ENV = "test"
    settings.ENABLE_E2E_TEST_AUTH = False
    settings.ACCESS_COOKIE_SECURE = False

    try:
        async with build_test_client(db) as client:
            response = await client.post(
                "/test/login",
                json={"email": "review-rating@example.com"},
            )
    finally:
        (
            settings.ENV,
            settings.ENABLE_E2E_TEST_AUTH,
            settings.ACCESS_COOKIE_SECURE,
        ) = original

    assert response.status_code == HTTPStatus.NOT_FOUND
