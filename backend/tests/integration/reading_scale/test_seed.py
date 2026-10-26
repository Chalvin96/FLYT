import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserLemmaContext
from scripts.seed_reading_scale import K_READING_SEED_PRESETS
from scripts.seed_reading_scale import load_reading_seed
from scripts.seed_reading_scale import seed_reading_scale

pytestmark = pytest.mark.anyio


async def test_seed_reading_scale_given_small_preset_expect_configured_row_counts(
    async_session: AsyncSession,
) -> None:
    size = K_READING_SEED_PRESETS["small"]

    seed = await seed_reading_scale(async_session, size)

    learner_id = seed.learner.id
    assert await _count(async_session, select(func.count(ReadingGroup.id))) == (
        size.theme_count
    )
    assert await _count(
        async_session,
        select(func.count(Story.id)).where(Story.visibility == StoryVisibility.PUBLIC),
    ) == (size.theme_count * size.stories_per_theme)
    assert await _count(
        async_session,
        select(func.count(UserLemma.id)).where(UserLemma.user_id == learner_id),
    ) == (size.known_lemma_count)
    assert await _count(
        async_session,
        select(func.count(UserLemmaContext.id)).where(
            UserLemmaContext.user_id == learner_id
        ),
    ) == (size.lookup_count)
    assert await _count(
        async_session,
        select(func.count(UserStory.id))
        .join(Story, Story.id == UserStory.story_id)
        .where(
            UserStory.user_id == learner_id,
            Story.visibility == StoryVisibility.PUBLIC,
        ),
    ) == (size.read_story_count)
    assert await _count(async_session, select(func.count(UserLemma.id))) == (
        size.known_lemma_count
        + size.other_learner_count * size.other_learner_known_lemma_count
    )
    assert await _count(async_session, select(func.count(ImportMeta.id))) == (
        size.import_count
    )


async def test_seed_reading_scale_given_two_runs_expect_identical_story_uuids(
    async_session: AsyncSession,
) -> None:
    size = K_READING_SEED_PRESETS["small"]

    first_run = await _seeded_story_uuids_then_rollback(async_session, size)
    second_run = await _seeded_story_uuids_then_rollback(async_session, size)

    assert first_run
    assert first_run == second_run


async def test_load_reading_seed_given_seeded_database_expect_seeded_handles(
    async_session: AsyncSession,
) -> None:
    seed = await seed_reading_scale(async_session, K_READING_SEED_PRESETS["small"])

    loaded = await load_reading_seed(async_session)

    assert loaded.learner.id == seed.learner.id
    assert loaded.theme_key == seed.theme_key
    assert loaded.read_story_uuid == seed.read_story_uuid


async def _count(db: AsyncSession, statement) -> int:
    return int(await db.scalar(statement) or 0)


async def _seeded_story_uuids_then_rollback(db: AsyncSession, size) -> list[str]:
    savepoint = await db.begin_nested()
    await seed_reading_scale(db, size)
    story_uuids = [
        str(story_uuid)
        for story_uuid in (
            await db.scalars(select(Story.uuid).order_by(Story.uuid))
        ).all()
    ]
    await savepoint.rollback()
    return story_uuids
