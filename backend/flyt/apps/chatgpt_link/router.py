from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession


from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkError
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkModelUpdate
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkPollResponse
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkRead
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkStartRequest
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkStartResponse
from flyt.apps.chatgpt_link.rotation import complete_link_poll
from flyt.apps.chatgpt_link.services import ChatGPTLinkService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.http import http_error


def get_chatgpt_link_service(
    db: AsyncSession = Depends(get_async_db),
) -> ChatGPTLinkService:
    return ChatGPTLinkService(db)


router = APIRouter(prefix="/chatgpt/link", tags=["chatgpt-link"])


@router.patch("")
async def set_chatgpt_link_model(
    payload: ChatGPTLinkModelUpdate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatGPTLinkService, Depends(get_chatgpt_link_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ChatGPTLinkRead:
    try:
        response = await service.set_model(user.id, payload.model)
    except ChatGPTLinkError as error:
        raise http_error(error) from error
    await db.commit()
    return response


@router.get("")
async def get_chatgpt_link(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatGPTLinkService, Depends(get_chatgpt_link_service)],
) -> ChatGPTLinkRead:
    return await service.get_link(current_user.id)


@router.post("/start")
async def start_chatgpt_link(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatGPTLinkService, Depends(get_chatgpt_link_service)],
    payload: ChatGPTLinkStartRequest | None = None,
) -> ChatGPTLinkStartResponse:
    try:
        return await service.start_link(
            current_user.id, payload.model if payload else None
        )
    except ChatGPTLinkError as error:
        raise http_error(error) from error


@router.post("/poll")
async def poll_chatgpt_link(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ChatGPTLinkPollResponse:
    try:
        return await complete_link_poll(db, current_user.id)
    except ChatGPTLinkError as error:
        raise http_error(error) from error


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chatgpt_link(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatGPTLinkService, Depends(get_chatgpt_link_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    await service.delete_link(current_user.id)
    # The deletion commits before pending cleanup: the upstream token is
    # already revoked, so a Redis failure must not roll back and strand a
    # row holding a revoked credential.
    await db.commit()
    await service.complete_link_unlink(current_user.id)
