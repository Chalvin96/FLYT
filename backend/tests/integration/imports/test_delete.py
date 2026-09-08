"""Integration tests for owner-scoped import deletion.

Deletion is inline, no background GC: removing the caller's ``UserStory`` erases the
shared ``Story`` (and its pages + ``ImportMeta`` via ``ON DELETE CASCADE``) only when
it was the content's last reference; a story another user still owns survives. The
per-content advisory lock in ``delete`` serializes the reclaim against a concurrent
dedup-ingress.
"""

import pytest
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.exceptions import ImportNotFoundError
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.import_text import content_hash as hash_text
from flyt.apps.reading.import_service import ImportService
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.core.db import AsyncSessionLocal
from tests.factories import ImportMetaFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory
from tests.factories import UserStoryFactory

pytestmark = pytest.mark.anyio


async def test_delete_given_last_owner_expect_story_pages_and_meta_erased(
    async_session: AsyncSession,
) -> None:
    # Arrange: a single owner, so this delete is the content's last reference.
    db = async_session
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    story_id, meta_id = meta.story_id, meta.id
    await StoryPageFactory.create(story_id=story_id, index=0)
    user_story = await UserStoryFactory.create(
        user_id=user.id, story_id=story_id, last_page_index=2
    )
    await db.flush()

    # Act
    await ImportService(db).delete(user_id=user.id, import_uuid=user_story.uuid)

    # Assert: reference gone AND the shared row erased inline (no GC), pages +
    # ImportMeta reclaimed via CASCADE.
    assert await db.get(Story, story_id) is None
    pages_left = await db.scalar(
        select(func.count())
        .select_from(StoryPage)
        .where(StoryPage.story_id == story_id)
    )
    assert pages_left == 0
    meta_left = await db.scalar(
        select(func.count()).select_from(ImportMeta).where(ImportMeta.id == meta_id)
    )
    assert meta_left == 0


async def test_delete_given_other_owner_expect_story_survives(
    async_session: AsyncSession,
) -> None:
    # Arrange: two users own the same deduplicated content.
    db = async_session
    first = await UserFactory.create()
    second = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    first_save = await UserStoryFactory.create(user_id=first.id, story_id=meta.story_id)
    second_save = await UserStoryFactory.create(
        user_id=second.id, story_id=meta.story_id
    )
    await db.flush()

    # Act: the first user deletes their reference.
    await ImportService(db).delete(user_id=first.id, import_uuid=first_save.uuid)

    # Assert: first reference gone, but the second owner still pins the story.
    assert await db.get(Story, meta.story_id) is not None
    assert await db.get(UserStory, second_save.id) is not None


async def test_delete_given_non_owner_expect_not_found_and_reference_intact(
    async_session: AsyncSession,
) -> None:
    # Arrange: owner saves an import; a stranger attempts to delete it.
    db = async_session
    owner = await UserFactory.create()
    stranger = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    user_story = await UserStoryFactory.create(user_id=owner.id, story_id=meta.story_id)
    await db.flush()

    # Act / Assert: denied (404 at the router; the service raises NotFound).
    with pytest.raises(ImportNotFoundError):
        await ImportService(db).delete(user_id=stranger.id, import_uuid=user_story.uuid)
    assert await db.get(UserStory, user_story.id) is not None
    assert await db.get(Story, meta.story_id) is not None


async def test_delete_then_resave_given_shared_story_expect_allowed(
    async_session: AsyncSession,
) -> None:
    # Arrange: two owners, so the story survives the first user's delete and the
    # freed (user, story) unique key can be re-saved.
    db = async_session
    user = await UserFactory.create()
    keeper = await UserFactory.create()
    meta = await ImportMetaFactory.create(status=ImportStatus.READY)
    save = await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await UserStoryFactory.create(user_id=keeper.id, story_id=meta.story_id)
    await db.flush()
    await ImportService(db).delete(user_id=user.id, import_uuid=save.uuid)
    await db.flush()

    # Act / Assert: a fresh save for the same (user, story) no longer conflicts.
    await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()
    count = await db.scalar(
        select(func.count())
        .select_from(UserStory)
        .where(UserStory.user_id == user.id, UserStory.story_id == meta.story_id)
    )
    assert count == 1


async def test_delete_given_caller_ends_without_commit_expect_reference_kept(
    setup_database: None,
) -> None:
    """The delete phase flushes only; the reference survives a caller that
    never commits."""
    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="import-delete-flush@example.com",
            display_name="Import Delete Flush",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        story = Story(
            title="Flush-only delete",
            content="tekst",
            cefr_level=None,
            slug=None,
            reading_group_id=None,
            visibility=StoryVisibility.PRIVATE,
            is_ready=False,
            word_count=1,
        )
        session.add(story)
        await session.flush()
        story_id = story.id
        digest = hash_text("tekst")
        session.add(
            ImportMeta(
                story_id=story_id,
                content_hash=digest,
                status=ImportStatus.PENDING,
            )
        )
        user_story = UserStory(
            user_id=user_id,
            story_id=story_id,
            last_page_index=0,
            completed=False,
        )
        session.add(user_story)
        await session.flush()
        import_uuid = user_story.uuid
        await session.commit()

    try:
        async with AsyncSessionLocal() as caller:
            await ImportService(caller).delete(user_id=user_id, import_uuid=import_uuid)

            async with AsyncSessionLocal() as verify:
                kept = await verify.scalar(
                    select(func.count())
                    .select_from(UserStory)
                    .where(UserStory.user_id == user_id)
                )
                assert kept == 1
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(
                sa_delete(UserStory).where(UserStory.user_id == user_id)
            )
            await cleanup.execute(sa_delete(Story).where(Story.id == story_id))
            await cleanup.execute(sa_delete(User).where(User.id == user_id))
            await cleanup.commit()
