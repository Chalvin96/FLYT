"""Guarded E2E test support routes.

These routes are ONLY mounted when ``ENV == "e2e"`` and
``ENABLE_E2E_TEST_AUTH`` is true. They allow Playwright to authenticate as a
seeded E2E user without going through Google OAuth.
"""

from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Response
from pydantic import BaseModel
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserSettings
from flyt.apps.users.schemas import UserRead
from flyt.apps.users.services import AuthService
from flyt.apps.users.utils import set_access_cookie
from flyt.core.config import settings
from flyt.core.db import get_async_db
from flyt.libs.utils.date import now


def require_e2e_enabled() -> None:
    if settings.ENV != "e2e" or not settings.ENABLE_E2E_TEST_AUTH:
        raise HTTPException(status_code=404, detail="Not found")
    if settings.ACCESS_COOKIE_SECURE:
        raise HTTPException(
            status_code=500,
            detail="E2E auth requires non-secure cookies",
        )


# Guard runs as a router-level dependency, not a manual in-body call, so any
# route added under /test/ in the future is guarded automatically and can't
# forget to call it.
router = APIRouter(
    prefix="/test",
    tags=["test-support"],
    dependencies=[Depends(require_e2e_enabled)],
)


class TestLoginRequest(BaseModel):
    email: EmailStr


@router.post("/login", response_model=UserRead)
async def test_login(
    payload: TestLoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> User:
    user = await db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        user = User(
            email=payload.email,
            display_name=payload.email.split("@")[0],
            avatar_url=None,
            last_login=now(),
        )
        db.add(user)
        await db.flush()
        db.add(UserSettings(user_id=user.id))
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider="e2e",
                provider_subject=payload.email,
                email_at_link=payload.email,
            )
        )
    else:
        user.last_login = now()

    await db.commit()
    await db.refresh(user)
    token = AuthService().create_access_token(data={"sub": str(user.uuid)})
    set_access_cookie(response, token)
    return user
