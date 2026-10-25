from http import HTTPStatus

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import User
from flyt.core.config import settings
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_access_token_given_login_expect_session_version_claim(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    claims = jwt.decode(
        client.cookies[settings.ACCESS_COOKIE_NAME],
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )

    assert claims["session_version"] == 0


async def test_logout_given_copied_cookie_and_bearer_expect_revoked_and_fresh_login_valid(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    user_id = user.id
    await authenticate(client, user)
    token = client.cookies[settings.ACCESS_COOKIE_NAME]

    logged_out = await client.post("/users/logout")
    bearer = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)
    cookie = await client.get("/users/me")

    assert logged_out.status_code == HTTPStatus.OK
    assert bearer.status_code == HTTPStatus.UNAUTHORIZED
    assert cookie.status_code == HTTPStatus.UNAUTHORIZED
    db.expunge_all()
    reloaded = await db.get(User, user_id)
    assert reloaded is not None
    assert reloaded.session_version == 1
    await authenticate(client, reloaded)
    assert (await client.get("/users/me")).status_code == HTTPStatus.OK


@pytest.mark.parametrize("version", [None, "0", True, -1, 1])
async def test_authentication_given_missing_or_wrong_session_version_expect_unauthorized(
    client: AsyncClient, version: object
) -> None:
    user = await UserFactory.create()
    claims = {"sub": str(user.uuid), "exp": 9999999999}
    if version is not None:
        claims["session_version"] = version
    token = jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    response = await client.get(
        "/users/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
