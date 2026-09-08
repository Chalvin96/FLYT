import contextlib

import pytest
from starlette.responses import Response

from flyt.apps.admin.auth import AdminAuthProvider
from flyt.apps.users.services import AuthService
from flyt.apps.users.types import UserRole
from flyt.apps.users.utils import clear_access_cookie
from flyt.core.config import settings
from tests.factories import UserFactory


pytestmark = pytest.mark.anyio


def _provider(async_session) -> AdminAuthProvider:
    @contextlib.asynccontextmanager
    async def session():
        yield async_session

    return AdminAuthProvider(session=session)


class _Req:
    """Minimal stand-in for starlette Request: cookies + mutable state."""

    def __init__(self, token: str | None) -> None:
        self.cookies = {settings.ACCESS_COOKIE_NAME: token} if token else {}

        class _State:
            pass

        self.state = _State()


def _token_for(user) -> str:
    return AuthService().create_access_token(data={"sub": str(user.uuid)})


async def test_authenticate_given_active_admin_expect_admin_user(  # ume-ignore: UME-PY003
    async_session,
) -> None:
    admin = await UserFactory.create(role=UserRole.ADMIN, is_active=True)
    req = _Req(_token_for(admin))
    admin_user = await _provider(async_session).authenticate(req)
    assert admin_user is not None
    assert admin_user.username == admin.display_name
    assert req.state.user.uuid == admin.uuid


async def test_authenticate_given_regular_user_expect_none(  # ume-ignore: UME-PY003
    async_session,
) -> None:
    user = await UserFactory.create(role=UserRole.USER)
    req = _Req(_token_for(user))
    assert await _provider(async_session).authenticate(req) is None


async def test_authenticate_given_inactive_admin_expect_none(  # ume-ignore: UME-PY003
    async_session,
) -> None:
    admin = await UserFactory.create(role=UserRole.ADMIN, is_active=False)
    req = _Req(_token_for(admin))
    assert await _provider(async_session).authenticate(req) is None


async def test_authenticate_given_no_cookie_expect_none(  # ume-ignore: UME-PY003
    async_session,
) -> None:
    req = _Req(None)
    assert await _provider(async_session).authenticate(req) is None


async def test_logout_clears_cookie_with_configured_domain_and_path(
    async_session, monkeypatch
) -> None:
    # When a cookie domain/path is configured, logout must clear the same cookie
    # variant the app set, or the access_token survives and the admin stays in.
    monkeypatch.setattr(settings, "ACCESS_COOKIE_DOMAIN", "example.com")
    monkeypatch.setattr(settings, "ACCESS_COOKIE_PATH", "/app")

    logout_response = await _provider(async_session).logout(_Req(None))

    expected = Response()
    clear_access_cookie(expected)
    set_cookie = logout_response.headers["set-cookie"]
    assert set_cookie == expected.headers["set-cookie"]
    assert "domain=example.com" in set_cookie.lower()
    assert "path=/app" in set_cookie.lower()
