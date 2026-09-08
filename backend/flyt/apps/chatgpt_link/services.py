from dataclasses import dataclass
from dataclasses import replace
from datetime import timedelta
import logging
from typing import Literal

from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link.clients import config as chatgpt_config
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.clients.manager import responses
from flyt.apps.chatgpt_link.clients.exceptions import ChatGPTAuthError
from flyt.apps.chatgpt_link.clients.exceptions import UpstreamAuthError
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.apps.chatgpt_link.types import DevicePollPending
from flyt.apps.chatgpt_link.types import PendingAuthorization
from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link.types import RenewedCredential
from flyt.apps.chatgpt_link.types import ProofVerdict
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkDisabledError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkIneligibleError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkModelUnavailableError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkPendingError
from flyt.apps.chatgpt_link.exceptions import ChatGPTLinkTransientError
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.chatgpt_link.models import ChatGPTLinkState
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkPollResponse
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkRead
from flyt.apps.chatgpt_link.schemas import pending_read
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkStartResponse
from flyt.core.config import settings
from flyt.libs.utils.date import now

logger = logging.getLogger(__name__)

_RENEWAL_WINDOW = timedelta(minutes=5)

_EXCEPTION_BY_SEPARATELY_ACTIONABLE_VERDICT: dict[ProofVerdict, type[Exception]] = {
    ProofVerdict.TERMINAL_INELIGIBLE: ChatGPTLinkIneligibleError,
    ProofVerdict.MODEL_UNAVAILABLE: ChatGPTLinkModelUnavailableError,
}


def is_rotation_due(link: ChatGPTLink) -> bool:
    return now() + _RENEWAL_WINDOW >= link.access_token_expires_at


def credential_from_link(link: ChatGPTLink) -> ChatGPTCredential:
    return ChatGPTCredential(
        access_token=link.access_token,
        refresh_token=link.refresh_token,
        chatgpt_account_id=link.chatgpt_account_id,
        access_token_expires_at=link.access_token_expires_at,
    )


def mark_broken(link: ChatGPTLink, reason: str | None) -> None:
    link.state = ChatGPTLinkState.BROKEN
    link.broken_reason = reason


def apply_rotation(link: ChatGPTLink, renewed: RenewedCredential) -> None:
    link.access_token = renewed.access_token
    link.access_token_expires_at = renewed.access_token_expires_at
    link.last_refresh_at = now()
    if renewed.refresh_token_or_keep_stored is not None:
        link.refresh_token = renewed.refresh_token_or_keep_stored


@dataclass(frozen=True)
class LinkPollOutcome:
    """A completed poll plus the tokens the composition boundary may revoke.

    ``issued_refresh_token`` is the newly issued credential; a definitively
    failed commit must revoke it. ``superseded_refresh_token`` is revoked only
    once the replacement is durable.
    """

    response: ChatGPTLinkPollResponse
    superseded_refresh_token: SecretStr | None
    issued_refresh_token: SecretStr | None = None


def _raise_for_proof_verdict(verdict: ProofVerdict) -> None:
    if verdict is ProofVerdict.LINKED:
        return
    specific = _EXCEPTION_BY_SEPARATELY_ACTIONABLE_VERDICT.get(verdict)
    if specific is not None:
        raise specific()
    raise ChatGPTLinkTransientError()


def _available_models() -> list[str]:
    return [settings.CHATGPT_DEFAULT_MODEL]


def _model_or_default(_model_key: str | None) -> str:
    return settings.CHATGPT_DEFAULT_MODEL


class ChatGPTLinkService:
    """Link lifecycle operations on the caller's session; flushes only."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_link(self, user_id: int) -> ChatGPTLinkRead:
        link = await self.find_link(user_id)
        pending = await pending_store.read(user_id)
        if link is None:
            return ChatGPTLinkRead(
                state="absent",
                pending=pending_read(pending),
                model=_model_or_default(pending.model_key if pending else None),
                available_models=_available_models(),
            )
        state: Literal["absent", "working", "broken"] = (
            "broken" if link.state is ChatGPTLinkState.BROKEN else "working"
        )
        return ChatGPTLinkRead(
            state=state,
            broken_reason=link.broken_reason,
            connected_at=link.created_at,
            pending=pending_read(pending),
            model=_model_or_default(link.model_key),
            available_models=_available_models(),
        )

    async def start_link(
        self, user_id: int, model_key: str | None = None
    ) -> ChatGPTLinkStartResponse:
        if not settings.CHATGPT_LINK_ENABLED:
            raise ChatGPTLinkDisabledError()
        if model_key is not None and model_key not in _available_models():
            raise ChatGPTLinkModelUnavailableError()
        try:
            device = await auth.request_device_authorization()
        except UpstreamAuthError as exc:
            logger.info("[chatgpt-link] start failed: status=%s", exc.status_code)
            raise ChatGPTLinkTransientError() from exc
        await pending_store.write(
            user_id, PendingAuthorization.of(device, settings.CHATGPT_DEFAULT_MODEL)
        )
        return ChatGPTLinkStartResponse(
            user_code=device.user_code,
            verification_url=chatgpt_config.VERIFICATION_URL,
            expires_at=device.expires_at,
        )

    async def poll_link(self, user_id: int) -> LinkPollOutcome:
        if not settings.CHATGPT_LINK_ENABLED:
            raise ChatGPTLinkDisabledError()
        pending = await pending_store.read(user_id)
        if pending is None:
            raise ChatGPTLinkPendingError()
        try:
            outcome = await auth.poll_device_authorization(
                pending.device_auth_id,
                pending.user_code,
            )
        except UpstreamAuthError as exc:
            logger.info("[chatgpt-link] poll failed: status=%s", exc.status_code)
            raise ChatGPTLinkTransientError() from exc
        if isinstance(outcome, DevicePollPending):
            return LinkPollOutcome(
                response=ChatGPTLinkPollResponse(status="pending"),
                superseded_refresh_token=None,
            )
        await pending_store.clear(user_id)
        try:
            credential = await auth.exchange_authorization_code(outcome)
        except UpstreamAuthError as exc:
            logger.info("[chatgpt-link] exchange failed: status=%s", exc.status_code)
            raise ChatGPTLinkTransientError() from exc
        except ChatGPTAuthError as exc:
            logger.info("[chatgpt-link] exchange returned an unusable token response")
            raise ChatGPTLinkTransientError() from exc
        chosen = _model_or_default(pending.model_key)
        try:
            verdict = await responses.prove_link(credential, chosen)
            _raise_for_proof_verdict(verdict)
            superseded = await self._persist_link(user_id, credential, chosen)
        except Exception:
            try:
                await auth.revoke_refresh_token(credential.refresh_token)
            except Exception:
                logger.warning("[chatgpt-link] revoke after failed link failed")
            raise
        logger.info(
            "[chatgpt-link] link recorded: user_id=%s model=%s", user_id, chosen
        )
        return LinkPollOutcome(
            response=ChatGPTLinkPollResponse(status="linked"),
            superseded_refresh_token=superseded,
            issued_refresh_token=credential.refresh_token,
        )

    async def delete_link(self, user_id: int) -> None:
        link = await self.find_link(user_id)
        if link is not None:
            await auth.revoke_refresh_token(link.refresh_token)
            await self._db.delete(link)
            logger.info("[chatgpt-link] link deleted: user_id=%s", user_id)

    async def complete_link_unlink(self, user_id: int) -> None:
        """Best-effort pending cleanup that must follow the unlink commit.

        The refresh token is already revoked upstream, so a Redis failure
        here must not surface as a failed, rolled-back deletion.
        """
        try:
            await pending_store.clear(user_id)
        except Exception:
            logger.warning(
                "[chatgpt-link] pending store clear failed after unlink: user_id=%s",
                user_id,
            )

    async def find_link(self, user_id: int) -> ChatGPTLink | None:
        return await self._db.scalar(
            select(ChatGPTLink).where(ChatGPTLink.user_id == user_id)
        )

    async def set_model(self, user_id: int, model_key: str) -> ChatGPTLinkRead:
        if model_key not in _available_models():
            raise ChatGPTLinkModelUnavailableError()
        link = await self.find_link(user_id)
        if link is not None:
            link.model_key = model_key
        else:
            await self._retain_pending_model(user_id, model_key)
        return await self.get_link(user_id)

    async def _retain_pending_model(self, user_id: int, model_key: str) -> None:
        """A model rejected before any link row exists must still be swappable."""
        pending = await pending_store.read(user_id)
        if pending is not None:
            await pending_store.write(user_id, replace(pending, model_key=model_key))

    async def _persist_link(
        self, user_id: int, credential: ChatGPTCredential, model_key: str
    ) -> SecretStr | None:
        """Persist the link and return the superseded token for post-commit
        revocation; the composition boundary commits before that revocation."""
        existing = await self.find_link(user_id)
        superseded = existing.refresh_token if existing is not None else None
        if existing is not None:
            existing.access_token = credential.access_token
            existing.refresh_token = credential.refresh_token
            existing.chatgpt_account_id = credential.chatgpt_account_id
            existing.access_token_expires_at = credential.access_token_expires_at
            existing.state = ChatGPTLinkState.WORKING
            existing.broken_reason = None
            existing.last_refresh_at = now()
            existing.model_key = model_key
        else:
            self._db.add(
                ChatGPTLink(
                    user_id=user_id,
                    access_token=credential.access_token,
                    refresh_token=credential.refresh_token,
                    chatgpt_account_id=credential.chatgpt_account_id,
                    access_token_expires_at=credential.access_token_expires_at,
                    state=ChatGPTLinkState.WORKING,
                    last_refresh_at=now(),
                    model_key=model_key,
                )
            )
        return superseded
