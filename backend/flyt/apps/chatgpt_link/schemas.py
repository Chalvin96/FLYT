from typing import Literal

from pydantic import BaseModel

from flyt.apps.chatgpt_link.types import PendingAuthorization

from flyt.core.schemas import UtcDatetime


class PendingAuthorizationRead(BaseModel):
    user_code: str
    expires_at: UtcDatetime


class ChatGPTLinkRead(BaseModel):
    state: Literal["absent", "working", "broken"]
    broken_reason: str | None = None
    connected_at: UtcDatetime | None = None
    pending: PendingAuthorizationRead | None = None
    model: str | None = None
    available_models: list[str] = []


class ChatGPTLinkModelUpdate(BaseModel):
    model: str


class ChatGPTLinkStartRequest(BaseModel):
    model: str | None = None


class ChatGPTLinkStartResponse(BaseModel):
    user_code: str
    verification_url: str
    expires_at: UtcDatetime


class ChatGPTLinkPollResponse(BaseModel):
    status: Literal["pending", "linked"]


def pending_read(
    pending: PendingAuthorization | None,
) -> PendingAuthorizationRead | None:
    if pending is None:
        return None
    return PendingAuthorizationRead(
        user_code=pending.user_code,
        expires_at=pending.expires_at,
    )
