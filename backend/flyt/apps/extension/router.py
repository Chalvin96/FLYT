from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends

from flyt.apps.extension.schemas import TranslationCreate
from flyt.apps.extension.schemas import TranslationRead
from flyt.apps.extension.services import ExtensionTranslationService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.exceptions import DomainException
from flyt.core.http import http_error
from sqlalchemy.ext.asyncio import AsyncSession


def get_extension_translation_service(
    db: AsyncSession = Depends(get_async_db),
) -> ExtensionTranslationService:
    return ExtensionTranslationService(db)


router = APIRouter(prefix="/extension", tags=["extension"])


@router.post("/translate")
async def translate_selection(
    body: TranslationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[
        ExtensionTranslationService,
        Depends(get_extension_translation_service),
    ],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TranslationRead:
    try:
        dispatch = await service.prepare_translation(current_user.id, body)
        # AI admission is durable before provider dispatch. The provider call
        # therefore runs with no open learner transaction or DB connection.
        await db.commit()
        return await service.dispatch_translation(dispatch)
    except DomainException as error:
        await db.rollback()
        raise http_error(error) from error
    except Exception:
        await db.rollback()
        raise
