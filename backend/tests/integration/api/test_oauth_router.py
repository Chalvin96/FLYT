from http import HTTPStatus
from unittest.mock import AsyncMock
from unittest.mock import patch

import jwt
import pytest
from authlib.integrations.starlette_client import OAuthError
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.core.config import settings
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

MOCK_CLAIMS = {
    "sub": "google-123",
    "iss": "https://accounts.google.com",
    "aud": "test-google-client-id",
    "email": "test@example.com",
    "email_verified": True,
    "name": "Test User",
    "picture": "https://img.example.com/photo.jpg",
}


@pytest.fixture(autouse=True)
def _match_google_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin GOOGLE_CLIENT_ID to MOCK_CLAIMS["aud"] so audience validation doesn't
    depend on the ambient env (CI sets it; local shells may not)."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-google-client-id")


async def test_callback_given_valid_claims_expect_redirect_with_cookie(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    with patch(
        "flyt.apps.users.router.oauth.google.authorize_access_token",
        new_callable=AsyncMock,
        return_value={"access_token": "mock", "userinfo": MOCK_CLAIMS},
    ):
        response = await client.get(
            "/users/oauth/google/callback", follow_redirects=False
        )

    assert response.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert response.headers["location"] == settings.FRONTEND_LOGIN_SUCCESS_URL
    cookie = response.cookies.get(settings.ACCESS_COOKIE_NAME)
    assert cookie is not None
    decoded = jwt.decode(cookie, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert "sub" in decoded

    user = await db.scalar(select(User).where(User.uuid == decoded["sub"]))
    assert user is not None
    assert user.email == "test@example.com"

    identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == "google-123",
            AuthIdentity.user_id == user.id,
        )
    )
    assert identity is not None
    assert identity.email_at_link == "test@example.com"


async def test_callback_given_access_denied_expect_silent_redirect(
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/users/oauth/google/callback?error=access_denied",
        follow_redirects=False,
    )

    assert response.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert response.headers["location"] == settings.FRONTEND_LOGIN_FAILURE_URL
    assert response.cookies.get(settings.ACCESS_COOKIE_NAME) is None


async def test_callback_given_oauth_error_expect_state_error(
    client: AsyncClient,
) -> None:
    with patch(
        "flyt.apps.users.router.oauth.google.authorize_access_token",
        new_callable=AsyncMock,
        side_effect=OAuthError("mismatch"),
    ):
        response = await client.get(
            "/users/oauth/google/callback", follow_redirects=False
        )

    assert response.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert "error=state" in response.headers["location"]


async def test_callback_given_unverified_email_expect_provider_error(
    client: AsyncClient,
) -> None:
    unverified_claims = {**MOCK_CLAIMS, "email_verified": False}
    with patch(
        "flyt.apps.users.router.oauth.google.authorize_access_token",
        new_callable=AsyncMock,
        return_value={"access_token": "mock", "userinfo": unverified_claims},
    ):
        response = await client.get(
            "/users/oauth/google/callback", follow_redirects=False
        )

    assert response.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert "error=provider" in response.headers["location"]


async def test_callback_given_invalid_audience_expect_provider_error(
    client: AsyncClient,
) -> None:
    invalid_audience_claims = {**MOCK_CLAIMS, "aud": "wrong-client-id"}
    with patch(
        "flyt.apps.users.router.oauth.google.authorize_access_token",
        new_callable=AsyncMock,
        return_value={"access_token": "mock", "userinfo": invalid_audience_claims},
    ):
        response = await client.get(
            "/users/oauth/google/callback", follow_redirects=False
        )

    assert response.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert "error=provider" in response.headers["location"]


async def test_read_users_me_given_cookie_expect_user_returned(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    user = await UserFactory.create(email="test@example.com", display_name="Test User")
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)

    response = await client.get("/users/me")
    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"


async def test_read_users_me_without_token_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.get("/users/me")
    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_update_users_me_given_display_name_expect_name_updated(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    user = await UserFactory.create(email="test@example.com", display_name="Old Name")
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)

    response = await client.patch("/users/me", json={"display_name": "  New Name  "})

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "New Name"


async def test_update_users_me_given_email_expect_email_ignored(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    user = await UserFactory.create(email="test@example.com", display_name="Old Name")
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)

    response = await client.patch(
        "/users/me",
        json={"display_name": "New Name", "email": "changed@example.com"},
    )

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "New Name"


async def test_update_users_me_given_blank_display_name_expect_validation_error(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    user = await UserFactory.create(email="test@example.com", display_name="Old Name")
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)

    response = await client.patch("/users/me", json={"display_name": "   "})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_logout_given_authenticated_user_expect_cookie_cleared(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    user = await UserFactory.create(email="test@example.com", display_name="Test User")
    auth = AuthService()
    token = auth.create_access_token(data={"sub": str(user.uuid)})
    client.cookies.set(settings.ACCESS_COOKIE_NAME, token)
    client.cookies.set("oauth_session", "mock-session")

    response = await client.post("/users/logout")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {}
    set_cookie_header = response.headers.get("set-cookie", "")
    assert f"{settings.ACCESS_COOKIE_NAME}=" in set_cookie_header
    assert "oauth_session=" in set_cookie_header
