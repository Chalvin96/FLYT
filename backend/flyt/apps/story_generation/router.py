from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession


from flyt.apps.story_generation.constants import K_GENERATE_STORY_JOB
from flyt.apps.story_generation.schemas import GenerationCreate
from flyt.apps.story_generation.schemas import GenerationCreateResponse
from flyt.apps.story_generation.schemas import GenerationCurrentRead
from flyt.apps.story_generation.schemas import GenerationImportCreate
from flyt.apps.story_generation.schemas import GenerationSurfaceRead
from flyt.apps.story_generation.service import GenerationService
from flyt.apps.reading.schemas import ImportItemRead
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.apps.users.services import UserVocabularyQueries
from flyt.core.db import get_async_db
from flyt.core.exceptions import DomainException
from flyt.core.queue import enqueue_job
from flyt.core.http import http_error


def get_generation_service(
    db: AsyncSession = Depends(get_async_db),
) -> GenerationService:
    return GenerationService(db, user_vocabulary_queries=UserVocabularyQueries(db))


router = APIRouter(prefix="/story-generation", tags=["story-generation"])


@router.get("")
async def get_surface(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GenerationService, Depends(get_generation_service)],
) -> GenerationSurfaceRead:
    return await service.load_surface(current_user.id)


@router.post(
    "/generations",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_generation(
    body: GenerationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GenerationService, Depends(get_generation_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> GenerationCreateResponse:
    try:
        response = await service.request_generation(
            user_id=current_user.id,
            provider_name=body.provider,
            anchor=body.anchor,
            length=body.length,
            topic=body.topic,
        )
    except DomainException as error:
        raise http_error(error) from error
    # Commit before enqueuing so a fast worker never reads a not-yet-visible
    # Generation row (which would otherwise leave the slot processing until TTL).
    await db.commit()
    await enqueue_job(K_GENERATE_STORY_JOB, response.generationId)
    return response


@router.get("/generations/current", response_model=GenerationCurrentRead | None)
async def get_current_generation(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GenerationService, Depends(get_generation_service)],
) -> GenerationCurrentRead | None:
    return await service.current(current_user.id)


@router.post(
    "/generations/current/import",
    status_code=status.HTTP_201_CREATED,
)
async def import_generated_story(
    body: GenerationImportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GenerationService, Depends(get_generation_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ImportItemRead:
    try:
        draft = await service.prepare_import(
            user_id=current_user.id,
            title=body.title,
        )
        # Commit before the tokenizer job is enqueued or pages are published:
        # the worker must see the import, and published pages leave with the
        # response.
        await db.commit()
        item = await service.finalize_import(draft)
        await db.commit()
        return item
    except DomainException as error:
        raise http_error(error) from error
