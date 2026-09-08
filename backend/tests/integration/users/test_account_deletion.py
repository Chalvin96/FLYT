from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import func
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link import pending_store
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import UserStory
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportQuota
from flyt.apps.users.deletion import AccountDeletionService
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserSettings
from flyt.apps.users.types import UserRole
from tests.factories import AuthIdentityFactory
from tests.factories import ChatGPTLinkFactory
from tests.factories import ImportMetaFactory
from tests.factories import StatsReviewLogFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import UserSettingsFactory
from tests.factories import UserStoryFactory

pytestmark = pytest.mark.anyio

K_EXPECTED_REVIEW_COUNT = 3


def deletion_service(db: AsyncSession) -> AccountDeletionService:
    return AccountDeletionService(db, stats=StatsQueryService(db))


async def delete_account_as_route(db: AsyncSession, user_id: int) -> None:
    """Mirror the route composition: flush, commit, then post-commit effects."""
    service = deletion_service(db)
    deleted = await service.delete_account(user_id)
    await db.commit()
    await service.complete_account_deletion(user_id, deleted)


async def count_where(db: AsyncSession, model, condition) -> int:
    total = await db.scalar(select(func.count()).select_from(model).where(condition))
    return int(total or 0)


async def test_delete_account_given_directly_owned_rows_expect_none_survive(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    await AuthIdentityFactory.create(user_id=user.id)
    await UserSettingsFactory.create(user_id=user.id)
    await UserLemmaFactory.create(user_id=user.id)
    user_card = await UserCardFactory.create(user_id=user.id)
    await StatsReviewLogFactory.create(user_id=user.id, user_card_id=user_card.id)
    db.add(ImportQuota(user_id=user.id, used=1))
    await db.flush()
    user_id = user.id

    await delete_account_as_route(db, user_id)

    assert await db.scalar(select(User).where(User.id == user_id)) is None
    for model, column in (
        (AuthIdentity, AuthIdentity.user_id),
        (UserSettings, UserSettings.user_id),
        (UserLemma, UserLemma.user_id),
        (UserCard, UserCard.user_id),
        (StatsReviewLog, StatsReviewLog.user_id),
        (ImportQuota, ImportQuota.user_id),
    ):
        assert await count_where(db, model, column == user_id) == 0


async def test_delete_account_given_sole_reference_import_expect_story_erased(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    story_id, meta_id = meta.story_id, meta.id
    await StoryPageFactory.create(story_id=story_id, index=0)
    await UserStoryFactory.create(user_id=user.id, story_id=story_id)
    await db.flush()

    await delete_account_as_route(db, user.id)

    assert await db.get(Story, story_id) is None
    assert await count_where(db, ImportMeta, ImportMeta.id == meta_id) == 0
    assert await count_where(db, StoryPage, StoryPage.story_id == story_id) == 0


async def test_delete_account_given_co_referenced_import_expect_story_survives(
    async_session: AsyncSession,
) -> None:

    db = async_session
    leaving = await UserFactory.create()
    staying = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    await UserStoryFactory.create(user_id=leaving.id, story_id=meta.story_id)
    await UserStoryFactory.create(user_id=staying.id, story_id=meta.story_id)
    await db.flush()

    await delete_account_as_route(db, leaving.id)

    assert await db.get(Story, meta.story_id) is not None
    assert await count_where(db, UserStory, UserStory.user_id == staying.id) == 1


async def test_delete_account_given_curated_story_expect_only_the_join_row_removed(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    curated = await StoryFactory.create()
    await UserStoryFactory.create(user_id=user.id, story_id=curated.id)
    await db.flush()
    user_id, curated_id = user.id, curated.id

    await delete_account_as_route(db, user_id)

    assert await db.get(Story, curated_id) is not None
    assert await count_where(db, UserStory, UserStory.story_id == curated_id) == 0


async def test_delete_account_given_import_refs_expect_hash_sorted_lock_order(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    for digest in ("cc", "aa", "bb"):
        meta = await ImportMetaFactory.create(content_hash=digest)
        await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()

    refs = await deletion_service(db)._imports.owned_import_refs(user.id)

    assert [ref.content_hash for ref in refs] == ["aa", "bb", "cc"]


async def test_deletion_preview_given_imports_expect_enumerated_count_not_quota_used(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    db.add(ImportQuota(user_id=user.id, used=3))
    await db.flush()

    preview = await deletion_service(db).deletion_preview(user.id)

    assert preview.importedTexts == 1


async def test_deletion_preview_given_review_logs_expect_lifetime_review_count(
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    user_card = await UserCardFactory.create(user_id=user.id)
    for _ in range(3):
        await StatsReviewLogFactory.create(user_id=user.id, user_card_id=user_card.id)
    await db.flush()

    preview = await deletion_service(db).deletion_preview(user.id)

    assert preview.reviews == K_EXPECTED_REVIEW_COUNT


async def test_delete_account_given_chatgpt_link_expect_refresh_token_revoked(
    monkeypatch: pytest.MonkeyPatch,
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    await ChatGPTLinkFactory.create_async(
        user_id=user.id, refresh_token="link-refresh-token"
    )
    await db.flush()
    user_id = user.id

    revoke = AsyncMock()
    monkeypatch.setattr(auth, "revoke_refresh_token", revoke)

    await delete_account_as_route(db, user_id)

    revoke.assert_awaited_once_with(SecretStr("link-refresh-token"))
    assert (
        await db.scalar(select(ChatGPTLink).where(ChatGPTLink.user_id == user_id))
        is None
    )


async def test_delete_account_given_revoke_raises_expect_account_still_deleted(
    monkeypatch: pytest.MonkeyPatch,
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    await ChatGPTLinkFactory.create_async(user_id=user.id)
    await db.flush()
    user_id = user.id

    monkeypatch.setattr(
        auth,
        "revoke_refresh_token",
        AsyncMock(side_effect=RuntimeError("upstream down")),
    )

    await delete_account_as_route(db, user_id)

    assert await db.scalar(select(User).where(User.id == user_id)) is None


async def test_delete_account_given_no_chatgpt_link_expect_revoke_never_called(
    monkeypatch: pytest.MonkeyPatch,
    async_session: AsyncSession,
) -> None:

    db = async_session
    user = await UserFactory.create()
    await db.flush()
    user_id = user.id

    revoke = AsyncMock()
    monkeypatch.setattr(auth, "revoke_refresh_token", revoke)

    await delete_account_as_route(db, user_id)

    revoke.assert_not_called()


async def test_delete_account_given_any_user_expect_pending_store_cleared(
    monkeypatch: pytest.MonkeyPatch,
    async_session: AsyncSession,
) -> None:
    db = async_session
    user = await UserFactory.create()
    await db.flush()
    user_id = user.id

    monkeypatch.setattr(auth, "revoke_refresh_token", AsyncMock())
    clear = AsyncMock()
    monkeypatch.setattr(pending_store, "clear", clear)

    await delete_account_as_route(db, user_id)

    clear.assert_awaited_once_with(user_id)


async def test_delete_account_given_pending_clear_raises_expect_account_still_deleted(
    monkeypatch: pytest.MonkeyPatch,
    async_session: AsyncSession,
) -> None:
    db = async_session
    user = await UserFactory.create()
    await db.flush()
    user_id = user.id

    monkeypatch.setattr(auth, "revoke_refresh_token", AsyncMock())
    monkeypatch.setattr(
        pending_store,
        "clear",
        AsyncMock(side_effect=RuntimeError("redis down")),
    )

    await delete_account_as_route(db, user_id)

    assert await db.scalar(select(User).where(User.id == user_id)) is None


async def test_delete_account_given_flush_only_expect_erasure_not_durable(
    setup_database: None,
) -> None:
    """The service flushes only: another transaction still sees the account
    until its composition root commits."""
    from flyt.core.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="deletion-flush-only@example.com",
            display_name="Deletion Flush Only",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    try:
        async with AsyncSessionLocal() as caller:
            service = AccountDeletionService(caller, stats=StatsQueryService(caller))
            deleted = await service.delete_account(user_id)
            assert deleted.chatgpt_refresh_token is None

            async with AsyncSessionLocal() as verify:
                survivor = await verify.scalar(select(User).where(User.id == user_id))
                assert survivor is not None

            await caller.commit()

        async with AsyncSessionLocal() as verify:
            assert await verify.scalar(select(User).where(User.id == user_id)) is None
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()
