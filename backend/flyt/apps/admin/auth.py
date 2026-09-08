from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

from starlette.requests import Request
from starlette.responses import RedirectResponse
from starlette.responses import Response
from starlette.templating import Jinja2Templates
from starlette_admin.auth import AdminUser
from starlette_admin.auth import AuthProvider
from starlette_admin.exceptions import LoginFailed

from flyt.apps.users.deps import resolve_user_from_token
from flyt.apps.users.types import UserRole
from flyt.apps.users.utils import clear_access_cookie
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal

# Route name of the Google OAuth start endpoint (see users/router.py).
_OAUTH_START_PATH = "/users/oauth/google/start"


class AdminAuthProvider(AuthProvider):
    """Authenticate the admin UI using the app's existing Google-OAuth cookie.

    The integer DB id never appears; identity is the JWT `sub` (user uuid).
    Access requires an active user with role == ADMIN.
    """

    def __init__(
        self,
        session: Callable[[], AbstractAsyncContextManager] = AsyncSessionLocal,
    ) -> None:
        super().__init__()
        self._session = session

    async def login(
        self,
        username: str,
        password: str,
        remember_me: bool,
        request: Request,
    ) -> Response:
        # App is Google-OAuth only: there is no password login for the admin.
        raise LoginFailed("Sign in through the app, then open /admin.")

    async def authenticate(self, request: Request) -> AdminUser | None:
        token = request.cookies.get(settings.ACCESS_COOKIE_NAME)
        if not token:
            return None
        async with self._session() as db:
            user = await resolve_user_from_token(token, db)
        if user is None or not user.is_active or user.role != UserRole.ADMIN:
            return None
        request.state.user = user
        return AdminUser(username=user.display_name, photo_url=user.avatar_url)

    async def render_login(
        self, request: Request, templates: Jinja2Templates
    ) -> Response:
        # OAuth-only: bounce unauthenticated visitors to Google sign-in.
        return RedirectResponse(_OAUTH_START_PATH)

    async def logout(self, request: Request) -> Response:
        # Clear with the same domain/path the app sets, or a configured
        # ACCESS_COOKIE_DOMAIN/PATH leaves the cookie (and session) intact.
        response = RedirectResponse("/admin")
        clear_access_cookie(response)
        return response
