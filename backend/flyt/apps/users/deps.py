from uuid import UUID

from fastapi import Cookie
from fastapi import Depends
from fastapi import Header
from fastapi import HTTPException
from fastapi import Request
from fastapi import Security
from fastapi import status
from fastapi.security import APIKeyCookie
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.stats.deps import get_stats_query_service
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.users.deletion import AccountDeletionService
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.apps.users.services import AuthService
from flyt.apps.users.services import OAuthService
from flyt.apps.users.services import UserLemmaService
from flyt.apps.users.services import UserService
from flyt.apps.users.services import UserSettingsService
from flyt.core.config import settings
from flyt.core.db import get_async_db
from flyt.core.http import error_response

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=error_response(
        "AUTHENTICATION_FAILED",
        "Could not validate credentials, try login again.",
    ),
    headers={"WWW-Authenticate": "Bearer"},
)
_AUTHORIZATION_SCHEME = "Bearer "
access_token_cookie_security = APIKeyCookie(
    name=settings.ACCESS_COOKIE_NAME,
    scheme_name="AccessCookie",
    auto_error=False,
)
bearer_token_security = HTTPBearer(
    scheme_name="BearerToken",
    auto_error=False,
)
K_BEARER_AUTHORIZATION_DEPENDENCY = Security(bearer_token_security)


def get_auth_service() -> AuthService:
    return AuthService()


def get_oauth_service(db: AsyncSession = Depends(get_async_db)) -> OAuthService:
    return OAuthService(db)


def get_user_settings_service(
    db: AsyncSession = Depends(get_async_db),
) -> UserSettingsService:
    return UserSettingsService(db)


def get_account_deletion_service(
    db: AsyncSession = Depends(get_async_db),
    stats: StatsQueryService = Depends(get_stats_query_service),
) -> AccountDeletionService:
    return AccountDeletionService(db, stats=stats)


def get_user_service(
    db: AsyncSession = Depends(get_async_db),
) -> UserService:
    return UserService(db)


def get_user_lemma_service(
    db: AsyncSession = Depends(get_async_db),
) -> UserLemmaService:
    return UserLemmaService(db)


async def resolve_user_from_token(token: str, db: AsyncSession) -> User | None:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_uuid = UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        return None

    return await db.scalar(select(User).where(User.uuid == user_uuid))


def build_bearer_authorization(
    credentials: HTTPAuthorizationCredentials
    | None = K_BEARER_AUTHORIZATION_DEPENDENCY,
) -> str | None:
    if credentials is None:
        return None
    return f"{credentials.scheme} {credentials.credentials}"


def _extract_token(cookie_token: str | None, authorization: str | None) -> str | None:
    if authorization is not None:
        scheme_length = len(_AUTHORIZATION_SCHEME)
        lowered = authorization[:scheme_length].lower()
        if (
            lowered == _AUTHORIZATION_SCHEME.lower()
            and len(authorization) > scheme_length
        ):
            return authorization[scheme_length:]
    return cookie_token


async def get_current_user(
    request: Request,
    token: str | None = Security(access_token_cookie_security),
    authorization: str | None = Security(build_bearer_authorization),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    resolved_token = _extract_token(token, authorization)
    if resolved_token is None:
        raise credentials_exception

    user = await resolve_user_from_token(resolved_token, db)
    if user is None or not user.is_active:
        raise credentials_exception
    request.state.user_id = str(user.uuid)
    return user


async def get_optional_user(
    request: Request,
    token: str | None = Cookie(default=None, alias=settings.ACCESS_COOKIE_NAME),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_async_db),
) -> User | None:
    resolved_token = _extract_token(token, authorization)
    if resolved_token is None:
        return None

    user = await resolve_user_from_token(resolved_token, db)
    if user is None or not user.is_active:
        return None
    request.state.user_id = str(user.uuid)
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response("FORBIDDEN", "Admin access required."),
        )
    return user
