"""Independent transaction boundaries for linked-credential durability.

Rotation and replacement must become durable before any dependent external
effect — a rotated token before it returns to provider transport, a
replacement before the superseded token is revoked — so these boundaries own
their commits while the service phases stay flush-only.
"""

import logging

from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link.clients.exceptions import RenewalFailedError
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.models import ChatGPTLinkState
from flyt.apps.chatgpt_link.schemas import ChatGPTLinkPollResponse
from flyt.apps.chatgpt_link.services import ChatGPTLinkService
from flyt.apps.chatgpt_link.services import LinkPollOutcome
from flyt.apps.chatgpt_link.services import apply_rotation
from flyt.apps.chatgpt_link.services import credential_from_link
from flyt.apps.chatgpt_link.services import is_rotation_due
from flyt.apps.chatgpt_link.services import mark_broken
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.apps.chatgpt_link.types import RenewalFailureClass
from flyt.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def renew_if_needed(user_id: int) -> ChatGPTCredential | None:
    """Renew a link's access token when it is expiring soon, or None when the
    link is absent, broken, or permanently failing to renew.

    Owns its session deliberately: renewal runs inside provider calls whose
    surrounding transaction may roll back afterward, and a rotated refresh
    token must survive that rollback.
    """
    async with AsyncSessionLocal() as session:
        link = await ChatGPTLinkService(session).find_link(user_id)
        if link is None or link.state is ChatGPTLinkState.BROKEN:
            return None
        if not is_rotation_due(link):
            return credential_from_link(link)
        try:
            renewed = await auth.renew_credential(link.refresh_token)
        except RenewalFailedError as error:
            if error.classification is RenewalFailureClass.PERMANENT:
                mark_broken(link, error.code)
                await session.commit()
                logger.info(
                    "[chatgpt-link] link broken: user_id=%s reason=%s",
                    user_id,
                    error.code,
                )
            return None
        apply_rotation(link, renewed)
        await session.commit()
        logger.info("[chatgpt-link] link renewed: user_id=%s", user_id)
        return credential_from_link(link)


async def complete_link_poll(db: AsyncSession, user_id: int) -> ChatGPTLinkPollResponse:
    """Finish a poll: commit the recorded link, then revoke what it superseded.

    The commit precedes the revocation because a crash between the two must
    leave the replacement persisted, not neither. A definitively failed commit
    leaves the replacement undurable, so the boundary rolls back and
    best-effort revokes the newly issued token before re-raising; an ambiguous
    outcome may have committed, so it propagates without any cleanup.
    """
    outcome: LinkPollOutcome = await ChatGPTLinkService(db).poll_link(user_id)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        await _revoke_refresh_token(outcome.issued_refresh_token)
        raise
    await _revoke_refresh_token(outcome.superseded_refresh_token)
    return outcome.response


async def _revoke_refresh_token(refresh_token: SecretStr | None) -> None:
    if refresh_token is None:
        return
    try:
        await auth.revoke_refresh_token(refresh_token)
    except Exception:
        logger.warning("[chatgpt-link] best-effort refresh token revoke failed")
