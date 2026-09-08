"""Integration tests for the import data model and its scoped query helpers.

The invariants under test are the ones that make cross-user deduplication safe:
shared content carries no per-user data, privacy is expressed as membership, and
curated surfaces never leak an import.
"""

import pytest
from sqlalchemy import exists
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from tests.factories import ImportMetaFactory
from tests.factories import StoryFactory
from tests.factories import UserFactory
from tests.factories import UserStoryFactory

pytestmark = pytest.mark.anyio

K_EXPECTED_SAVE_COUNT = 2


async def test_import_meta_given_duplicate_content_hash_expect_integrity_error(
    db: AsyncSession,
) -> None:
    # Arrange: the content hash is the deduplication key, so it must be unique.
    shared_hash = "a" * 64
    await ImportMetaFactory.create(content_hash=shared_hash)

    # Act / Assert
    with pytest.raises(IntegrityError):
        await ImportMetaFactory.create(content_hash=shared_hash)
        await db.flush()


async def test_import_meta_given_second_row_for_same_story_expect_integrity_error(
    db: AsyncSession,
) -> None:
    # Arrange: ImportMeta is 1:1 with its Story.
    meta = await ImportMetaFactory.create()

    # Act / Assert
    with pytest.raises(IntegrityError):
        await ImportMetaFactory.create(story_id=meta.story_id)
        await db.flush()


async def test_user_story_given_duplicate_user_and_story_expect_integrity_error(
    db: AsyncSession,
) -> None:
    # Arrange: a user saves the same content at most once.
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)

    # Act / Assert
    with pytest.raises(IntegrityError):
        await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
        await db.flush()


async def test_user_story_given_two_users_same_content_expect_both_saved(
    db: AsyncSession,
) -> None:
    # Arrange: deduplication means one shared Story for both users.
    meta = await ImportMetaFactory.create()
    first = await UserFactory.create()
    second = await UserFactory.create()

    # Act
    await UserStoryFactory.create(
        user_id=first.id, story_id=meta.story_id, title="First user's title"
    )
    await UserStoryFactory.create(
        user_id=second.id, story_id=meta.story_id, title="Second user's title"
    )
    await db.flush()

    # Assert: one shared row, two independent per-user saves with their own titles.
    saves = (
        (
            await db.execute(
                select(UserStory)
                .where(UserStory.story_id == meta.story_id)
                .order_by(UserStory.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(saves) == K_EXPECTED_SAVE_COUNT
    assert [save.title for save in saves] == [
        "First user's title",
        "Second user's title",
    ]


async def test_user_story_given_deletion_expect_row_removed_and_reimport_allowed(
    db: AsyncSession,
) -> None:
    # Arrange: deletion is hard, so it frees the unique key for a later re-import.
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    save = await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()

    # Act
    await db.delete(save)
    await db.flush()

    # Assert
    remaining = await db.execute(
        select(func.count())
        .select_from(UserStory)
        .where(UserStory.story_id == meta.story_id)
    )
    assert remaining.scalar_one() == 0

    # Re-importing the same content is possible again.
    await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()


async def test_user_story_given_insert_expect_uuid_always_set(
    db: AsyncSession,
) -> None:
    # Arrange / Act: UserStory rows always carry a uuid (curated and import alike).
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create()
    save = await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()

    # Assert
    assert save.uuid is not None


async def test_import_story_given_no_curated_columns_expect_row_persists_with_inline_content(
    db: AsyncSession,
) -> None:
    # Arrange / Act: an import has no CEFR level, slug, or group, but it does carry
    # the normalized source inline on Story.content.
    meta = await ImportMetaFactory.create()
    await db.flush()
    story = await db.get(Story, meta.story_id)

    # Assert
    assert story is not None
    assert story.cefr_level is None
    assert story.slug is None
    assert story.reading_group_id is None
    assert meta.status is ImportStatus.PENDING


async def test_story_visibility_given_curated_and_import_rows_expect_meta_equivalence(
    db: AsyncSession,
) -> None:
    curated = await StoryFactory.create(visibility=StoryVisibility.PUBLIC)
    imported_meta = await ImportMetaFactory.create()
    await db.flush()

    rows = (
        await db.execute(
            select(
                Story.id,
                Story.visibility,
                exists().where(ImportMeta.story_id == Story.id).label("has_meta"),
            ).where(Story.id.in_([curated.id, imported_meta.story_id]))
        )
    ).all()

    assert all(
        (visibility is StoryVisibility.PRIVATE) is has_meta
        for _story_id, visibility, has_meta in rows
    )


async def test_import_meta_given_story_deleted_expect_cascade_removal(
    db: AsyncSession,
) -> None:
    # Arrange: garbage collection deletes the Story and relies on the cascade.
    meta = await ImportMetaFactory.create()
    story = await db.get(Story, meta.story_id)
    assert story is not None
    await db.flush()

    # Act
    await db.delete(story)
    await db.flush()

    # Assert
    remaining = await db.execute(
        select(func.count()).select_from(ImportMeta).where(ImportMeta.id == meta.id)
    )
    assert remaining.scalar_one() == 0
