import logging
from typing import Annotated

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import Response
from joserfc.errors import JoseError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import RedirectResponse

from flyt.apps.users.deletion import AccountDeletionService
from flyt.apps.users.deps import get_account_deletion_service
from flyt.apps.users.deps import get_auth_service
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.deps import get_oauth_service
from flyt.apps.users.deps import get_user_service
from flyt.apps.users.exceptions import AuthenticationError
from flyt.apps.users.models import User
from flyt.apps.users.schemas import DeletionPreviewRead
from flyt.apps.users.schemas import UserRead
from flyt.apps.users.schemas import UserUpdate
from flyt.apps.users.services import AuthService
from flyt.apps.users.services import OAuthClaims
from flyt.apps.users.services import OAuthService
from flyt.apps.users.services import UserService
from flyt.apps.users.utils import clear_access_cookie
from flyt.apps.users.utils import set_access_cookie
from flyt.clients.oauth import oauth
from flyt.core.config import settings
from flyt.core.db import get_async_db
from flyt.core.http import EmptyResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/oauth/google/start")
async def google_start(request: Request) -> RedirectResponse:
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/oauth/google/callback")
async def google_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    oauth_service: Annotated[OAuthService, Depends(get_oauth_service)],
) -> Response:
    if request.query_params.get("error") == "access_denied":
        return RedirectResponse(settings.FRONTEND_LOGIN_FAILURE_URL)

    try:
        token = await oauth.google.authorize_access_token(request)
    except (OAuthError, JoseError) as exc:
        logger.warning("[oauth.google.callback] state/exchange failed: %s", exc)
        return RedirectResponse(f"{settings.FRONTEND_LOGIN_FAILURE_URL}?error=state")

    try:
        userinfo = token.get("userinfo")
        if userinfo is None:
            raise AuthenticationError("Missing userinfo in token response")
        claims = OAuthClaims.model_validate(userinfo)
        user = await oauth_service.login_or_register_google(claims)
        await db.commit()
    except (OAuthError, ValidationError) as exc:
        logger.warning(
            "[oauth.google.callback] provider claim validation failed: %s", exc
        )
        await db.rollback()
        return RedirectResponse(f"{settings.FRONTEND_LOGIN_FAILURE_URL}?error=provider")
    except AuthenticationError as exc:
        logger.warning("[oauth.google.callback] missing or invalid userinfo: %s", exc)
        await db.rollback()
        return RedirectResponse(f"{settings.FRONTEND_LOGIN_FAILURE_URL}?error=provider")
    except Exception:
        logger.exception("[oauth.google.callback] internal failure")
        await db.rollback()
        return RedirectResponse(f"{settings.FRONTEND_LOGIN_FAILURE_URL}?error=internal")

    access_token = auth_service.create_access_token(data={"sub": str(user.uuid)})
    redirect = RedirectResponse(settings.FRONTEND_LOGIN_SUCCESS_URL)
    set_access_cookie(redirect, access_token)
    return redirect


def require_dev_login_enabled() -> None:

    if settings.ENV != "development":
        raise HTTPException(status_code=404, detail="Not found")


dev_router = APIRouter(
    prefix="/users",
    tags=["users-dev"],
    dependencies=[Depends(require_dev_login_enabled)],
)


@dev_router.get("/dev/login")
async def dev_login(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    email: str = "dev@flyt.dev",
) -> Response:
    from sqlalchemy import select

    from flyt.apps.users.models import AuthIdentity
    from flyt.apps.users.models import UserSettings

    user = await db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, display_name=email.split("@")[0], last_login=None)
        db.add(user)
        await db.flush()
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider="dev",
                provider_subject=email,
                email_at_link=email,
            )
        )
        db.add(UserSettings(user_id=user.id))
        await db.flush()
    await db.commit()
    await db.refresh(user)

    access_token = auth_service.create_access_token(data={"sub": str(user.uuid)})
    redirect = RedirectResponse(settings.FRONTEND_LOGIN_SUCCESS_URL)
    set_access_cookie(redirect, access_token)
    return redirect


@router.post("/logout")
async def logout(response: Response) -> EmptyResponse:
    logger.info("[users.logout] entering")
    clear_access_cookie(response)
    response.delete_cookie(
        key="oauth_session",
        path="/",
        secure=settings.ACCESS_COOKIE_SECURE,
        samesite="lax",
    )
    logger.info("[users.logout] exiting")
    return EmptyResponse()


@router.get("/me", response_model=UserRead)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    logger.info(
        "[users.read_users_me] entering with params user_id=%s", current_user.id
    )
    logger.info("[users.read_users_me] exiting with params user_id=%s", current_user.id)
    return current_user


@router.get("/me/deletion-preview")
async def read_deletion_preview(
    current_user: Annotated[User, Depends(get_current_user)],
    deletion_service: Annotated[
        AccountDeletionService, Depends(get_account_deletion_service)
    ],
) -> DeletionPreviewRead:
    logger.info(
        "[users.read_deletion_preview] entering with params user_id=%s", current_user.id
    )
    preview = await deletion_service.deletion_preview(current_user.id)
    logger.info(
        "[users.read_deletion_preview] exiting with params user_id=%s", current_user.id
    )
    return preview


@router.delete("/me")
async def delete_users_me(
    response: Response,
    current_user: Annotated[User, Depends(get_current_user)],
    deletion_service: Annotated[
        AccountDeletionService, Depends(get_account_deletion_service)
    ],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EmptyResponse:
    logger.info(
        "[users.delete_users_me] entering with params user_id=%s", current_user.id
    )
    deleted = await deletion_service.delete_account(current_user.id)
    # The erasure commits before the provider revocation: a crash between the
    # two must leave the account gone, not half-deleted.
    await db.commit()
    await deletion_service.complete_account_deletion(current_user.id, deleted)
    clear_access_cookie(response)
    logger.info(
        "[users.delete_users_me] exiting with params user_id=%s", current_user.id
    )
    return EmptyResponse()


@router.patch("/me", response_model=UserRead)
async def update_users_me(
    payload: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    user_service: Annotated[UserService, Depends(get_user_service)],
) -> User:
    logger.info(
        "[users.update_users_me] entering with params user_id=%s", current_user.id
    )
    await user_service.update_display_name(current_user, payload.display_name)
    await db.commit()
    await db.refresh(current_user)
    logger.info(
        "[users.update_users_me] exiting with params user_id=%s", current_user.id
    )
    return current_user
