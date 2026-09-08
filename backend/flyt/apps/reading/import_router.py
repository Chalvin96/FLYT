"""Import ingress + listing endpoints. See knowledge/domains/reading.md."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.constants import PROCESS_IMPORT_JOB
from flyt.apps.reading.constants import DEFAULT_PAGE_LIMIT
from flyt.apps.reading.constants import MAX_PAGE_LIMIT
from flyt.apps.reading.exceptions import ImportEmptyError
from flyt.apps.reading.exceptions import ImportInvalidCursorError
from flyt.apps.reading.exceptions import ImportInvalidSourceUrlError
from flyt.apps.reading.exceptions import ImportNotFoundError
from flyt.apps.reading.exceptions import ImportNotRetryableError
from flyt.apps.reading.exceptions import ImportQuotaExceededError
from flyt.apps.reading.exceptions import ImportTooLargeError
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.schemas import ExtensionImportCreate
from flyt.apps.reading.schemas import ImportItemRead
from flyt.apps.reading.schemas import ImportListResponse
from flyt.apps.reading.schemas import PasteImportCreate
from flyt.apps.reading.schemas import RetryImportResponse
from flyt.apps.reading.import_service import ImportService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.queue import enqueue_job
from flyt.core.http import http_error


def get_import_service(db: AsyncSession = Depends(get_async_db)) -> ImportService:
    return ImportService(db)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_paste_import(
    body: PasteImportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ImportItemRead:
    try:
        draft = await service.create(
            user_id=current_user.id,
            text_value=body.text,
            title=body.title,
            source_url=None,
        )
        # Commit before the tokenizer job is enqueued: the worker must see
        # the import, and published pages leave with the response.
        await db.commit()
        item = await service.finalize_import(draft)
        await db.commit()
        return item
    except (
        ImportEmptyError,
        ImportTooLargeError,
        ImportInvalidSourceUrlError,
        ImportQuotaExceededError,
    ) as error:
        raise http_error(error) from error


@router.post("/extension", status_code=status.HTTP_201_CREATED)
async def create_extension_import(
    body: ExtensionImportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ImportItemRead:
    try:
        draft = await service.create(
            user_id=current_user.id,
            text_value=body.text,
            title=body.title,
            source_url=body.source_url,
        )
        await db.commit()
        item = await service.finalize_import(draft)
        await db.commit()
        return item
    except (
        ImportEmptyError,
        ImportTooLargeError,
        ImportInvalidSourceUrlError,
        ImportQuotaExceededError,
    ) as error:
        raise http_error(error) from error


@router.get("")
async def list_imports(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
    status_filter: Annotated[ImportStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query()] = None,
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_LIMIT)] = DEFAULT_PAGE_LIMIT,
) -> ImportListResponse:
    try:
        return await service.list_imports(
            user_id=current_user.id,
            status=status_filter,
            query=q,
            cursor=cursor,
            limit=limit,
        )
    except ImportInvalidCursorError as error:
        raise http_error(error) from error


@router.get("/{import_uuid}")
async def get_import(
    import_uuid: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
) -> ImportItemRead:
    try:
        return await service.get_import(
            user_id=current_user.id, import_uuid=import_uuid
        )
    except ImportNotFoundError as error:
        raise http_error(error) from error


@router.post(
    "/{import_uuid}/retry",
    status_code=status.HTTP_202_ACCEPTED,
)
async def retry_import_endpoint(
    import_uuid: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> RetryImportResponse:
    try:
        story_id = await service.retry(user_id=current_user.id, import_uuid=import_uuid)
    except (ImportNotFoundError, ImportNotRetryableError) as error:
        raise http_error(error) from error
    # Commit before re-enqueuing so the worker never reads a stale status.
    await db.commit()
    await enqueue_job(PROCESS_IMPORT_JOB, story_id)
    return RetryImportResponse(status="retrying")


@router.delete("/{import_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import(
    import_uuid: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ImportService, Depends(get_import_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    try:
        await service.delete(user_id=current_user.id, import_uuid=import_uuid)
    except ImportNotFoundError as error:
        # 404 for a non-owner too: a 403 would confirm the content exists.
        raise http_error(error) from error
    await db.commit()
