import logging

from dataclasses import dataclass

from pydantic import SecretStr
from sqlalchemy import delete as sa_delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.reading.import_service import ImportService
from flyt.apps.users.models import User
from flyt.apps.users.schemas import DeletionPreviewRead

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeletedAccount:
    """The durable erasure plus the external effects that must follow it."""

    chatgpt_refresh_token: SecretStr | None
    imports_erased: int
    stories_erased: int


class AccountDeletionService:
    def __init__(self, db: AsyncSession, stats: StatsQueryService) -> None:
        self._db = db
        self._stats = stats
        self._imports = ImportService(db)

    async def deletion_preview(self, user_id: int) -> DeletionPreviewRead:
        return DeletionPreviewRead(
            streak=await self._stats.get_streak(user_id=user_id),
            reviews=await self.review_count(user_id),
            wordsPracticed=await self._stats.get_words_practiced_count(user_id=user_id),
            importedTexts=await self._imports.owned_import_count(user_id),
        )

    async def review_count(self, user_id: int) -> int:
        total = await self._db.scalar(
            select(func.count())
            .select_from(StatsReviewLog)
            .where(StatsReviewLog.user_id == user_id)
        )
        return int(total or 0)

    async def delete_account(self, user_id: int) -> DeletedAccount:
        """Erase the account in one flush-only transaction; the route commits
        before any dependent external effect runs."""
        await self._db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
            {"key": f"quota:{user_id}"},
        )

        chatgpt_refresh_token = await self._db.scalar(
            select(ChatGPTLink.refresh_token).where(ChatGPTLink.user_id == user_id)
        )

        refs = await self._imports.owned_import_refs(user_id)
        stories_erased = 0
        for ref in refs:
            if await self._imports.release_reference(ref):
                stories_erased += 1

        await self._db.execute(sa_delete(User).where(User.id == user_id))
        return DeletedAccount(
            chatgpt_refresh_token=chatgpt_refresh_token,
            imports_erased=len(refs),
            stories_erased=stories_erased,
        )

    async def complete_account_deletion(
        self, user_id: int, deleted: DeletedAccount
    ) -> None:
        """Best-effort external effects that must follow the deletion commit."""
        logger.info(
            "[users.delete_account] erased user_id=%s imports=%s stories=%s",
            user_id,
            deleted.imports_erased,
            deleted.stories_erased,
        )
        if deleted.chatgpt_refresh_token is not None:
            try:
                await auth.revoke_refresh_token(deleted.chatgpt_refresh_token)
            except Exception:
                logger.warning(
                    "[users.delete_account] chatgpt revoke failed: user_id=%s",
                    user_id,
                )
        try:
            await pending_store.clear(user_id)
        except Exception:
            logger.warning(
                "[users.delete_account] pending store clear failed: user_id=%s",
                user_id,
            )
