from datetime import datetime
from datetime import timedelta
from datetime import UTC
from http import HTTPStatus
from typing import cast
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.deps import get_current_user
from flyt.apps.users.services import AuthService
from flyt.core.config import settings
from tests.factories import UserFactory

MAX_TOKEN_EXPIRY_DIFFERENCE_SECONDS = 2


def _make_request() -> Request:
    return Request(scope={"type": "http", "headers": [], "path": "/", "method": "GET"})


def test_create_access_token_given_data_expect_valid_jwt() -> None:
    auth = AuthService()
    data = {"sub": "123"}
    token = auth.create_access_token(data)
    assert isinstance(token, str)
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == "123"
    assert "exp" in decoded


def test_create_access_token_given_expires_delta_expect_correct_expiry() -> None:
    auth = AuthService()
    data = {"sub": "123"}
    delta = timedelta(hours=1)
    token = auth.create_access_token(data, expires_delta=delta)
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    expected_exp = datetime.now(UTC) + delta
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=UTC)
    diff = abs((actual_exp - expected_exp).total_seconds())
    assert diff < MAX_TOKEN_EXPIRY_DIFFERENCE_SECONDS


def test_create_access_token_given_no_expires_delta_expect_settings_default() -> None:
    auth = AuthService()
    data = {"sub": "123"}
    token = auth.create_access_token(data)
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    expected_exp = datetime.now(UTC) + timedelta(
        hours=settings.ACCESS_TOKEN_EXPIRE_HOURS
    )
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=UTC)
    diff = abs((actual_exp - expected_exp).total_seconds())
    assert diff < MAX_TOKEN_EXPIRY_DIFFERENCE_SECONDS


@pytest.mark.anyio
@pytest.mark.anyio
async def test_get_current_user_given_valid_token_expect_user_returned(
    async_session: AsyncSession,
) -> None:
    auth = AuthService()
    user = await UserFactory.create(email="test@example.com", display_name="Test User")

    token = auth.create_access_token(data={"sub": str(user.uuid)})
    result = await get_current_user(
        request=_make_request(),
        token=token,
        authorization=None,
        db=async_session,
    )

    assert result.id == user.id
    assert result.email == user.email
    assert result.display_name == user.display_name


@pytest.mark.anyio
async def test_get_current_user_given_invalid_token_expect_error(
    async_session: AsyncSession,
) -> None:
    await UserFactory.create(email="test@example.com", display_name="Test User")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_make_request(),
            token="invalidtoken",
            authorization=None,
            db=async_session,
        )

    detail = cast(dict[str, str | None], exc_info.value.detail)
    assert exc_info.value.status_code == HTTPStatus.UNAUTHORIZED
    assert detail["code"] == "AUTHENTICATION_FAILED"
    assert detail["message"] == "Could not validate credentials, try login again."


@pytest.mark.anyio
async def test_get_current_user_given_expired_token_expect_error(
    async_session: AsyncSession,
) -> None:
    auth = AuthService()
    user = await UserFactory.create(email="test@example.com", display_name="Test User")

    token = auth.create_access_token(
        data={"sub": str(user.uuid)}, expires_delta=timedelta(seconds=-1)
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_make_request(),
            token=token,
            authorization=None,
            db=async_session,
        )

    detail = cast(dict[str, str | None], exc_info.value.detail)
    assert exc_info.value.status_code == HTTPStatus.UNAUTHORIZED
    assert detail["code"] == "AUTHENTICATION_FAILED"
    assert detail["message"] == "Could not validate credentials, try login again."


@pytest.mark.anyio
async def test_get_current_user_given_nonexistent_user_expect_error(
    async_session: AsyncSession,
) -> None:
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(uuid4())})

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_make_request(),
            token=token,
            authorization=None,
            db=async_session,
        )

    detail = cast(dict[str, str | None], exc_info.value.detail)
    assert exc_info.value.status_code == HTTPStatus.UNAUTHORIZED
    assert detail["code"] == "AUTHENTICATION_FAILED"
    assert detail["message"] == "Could not validate credentials, try login again."


@pytest.mark.anyio
async def test_get_current_user_given_inactive_user_expect_unauthorized(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create(is_active=False)
    token = AuthService().create_access_token(data={"sub": str(user.uuid)})

    with pytest.raises(HTTPException) as exc:
        await get_current_user(
            request=_make_request(),
            token=token,
            authorization=None,
            db=async_session,
        )
    assert exc.value.status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.anyio
async def test_get_current_user_given_token_without_sub_expect_error(
    async_session: AsyncSession,
) -> None:
    token = jwt.encode(
        {"exp": 9999999999}, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            request=_make_request(),
            token=token,
            authorization=None,
            db=async_session,
        )

    detail = cast(dict[str, str | None], exc_info.value.detail)
    assert exc_info.value.status_code == HTTPStatus.UNAUTHORIZED
    assert detail["code"] == "AUTHENTICATION_FAILED"
    assert detail["message"] == "Could not validate credentials, try login again."
