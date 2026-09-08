from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status

from flyt.apps.chatbot.schemas import ChatbotMessageCreate
from flyt.apps.chatbot.schemas import ChatbotMessageRead
from flyt.apps.chatbot.schemas import ChatbotSurfaceRead
from flyt.apps.chatbot.schemas import OpenRouterKeyRead
from flyt.apps.chatbot.schemas import OpenRouterKeyUpdate
from flyt.apps.chatbot.services import ChatbotService
from flyt.apps.chatbot.services import UserOpenRouterKeyService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.exceptions import DomainException
from flyt.core.http import http_error
from sqlalchemy.ext.asyncio import AsyncSession


def get_chatbot_service(db: AsyncSession = Depends(get_async_db)) -> ChatbotService:
    return ChatbotService(db)


router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.get("")
async def get_chatbot_surface(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatbotService, Depends(get_chatbot_service)],
) -> ChatbotSurfaceRead:
    return await service.load_surface(current_user.id)


@router.post("/messages")
async def send_chatbot_message(
    body: ChatbotMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatbotService, Depends(get_chatbot_service)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ChatbotMessageRead:
    try:
        dispatch = await service.prepare_message(current_user.id, body)
        # Durable debit before dispatch: a failed or cancelled provider call
        # still spends. Funded dispatch holds no open transaction; linked
        # ChatGPT and learner-key OpenRouter inference still re-open one for
        # their post-commit credential reads (pre-existing, next plan).
        await db.commit()
        return await service.dispatch_message(dispatch)
    except DomainException as error:
        raise http_error(error) from error


@router.put("/openrouter-key")
async def replace_openrouter_key(
    body: OpenRouterKeyUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OpenRouterKeyRead:
    try:
        response = await UserOpenRouterKeyService(db).replace_api_key(
            current_user.id, body.apiKey
        )
    except DomainException as error:
        raise http_error(error) from error
    await db.commit()
    return response


@router.delete(
    "/openrouter-key",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_openrouter_key(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    await UserOpenRouterKeyService(db).delete_api_key(current_user.id)
    await db.commit()
