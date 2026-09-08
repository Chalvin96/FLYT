"""Unit tests for ReadingService home composition (GET /reading/home)."""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.services import ReadingService
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

EXPECTED_SECTION_STORY_LIMIT = 6
EXPECTED_OVER_LIMIT_SEED_STORY_COUNT = 8
EXPECTED_FEWER_SEED_STORY_COUNT = 2


def reading_service(session: AsyncSession) -> ReadingService:
    return ReadingService(session)


async def test_get_home_given_no_groups_expect_empty_sections_and_no_hero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    home = await reading_service(async_session).get_home(user.id)

    assert home.hero is None
    assert home.sections == []


async def test_list_home_sections_given_fewer_stories_than_limit_expect_all_stories_listed(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="few", title="Few", order=1)
    older = await StoryFactory.create(
        reading_group=group,
        title="Older",
        created_at=datetime(2026, 4, 1, 10, 0),
    )
    newer = await StoryFactory.create(
        reading_group=group,
        title="Newer",
        created_at=datetime(2026, 4, 2, 10, 0),
    )
    await StoryPageFactory.create(story=older, index=0)
    await StoryPageFactory.create(story=newer, index=0)

    sections = await reading_service(async_session).list_home_sections(user.id)

    assert len(sections) == 1
    assert sections[0].group.id == group.id
    assert sections[0].story_count == EXPECTED_FEWER_SEED_STORY_COUNT
    assert [item.story.title for item in sections[0].stories] == ["Newer", "Older"]


async def test_list_home_sections_given_more_stories_than_limit_expect_window_caps_section(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="many", title="Many", order=1)
    for offset in range(EXPECTED_OVER_LIMIT_SEED_STORY_COUNT):
        story = await StoryFactory.create(
            reading_group=group,
            title=f"story-{offset}",
            created_at=datetime(2026, 4, 1 + offset, 10, 0),
        )
        await StoryPageFactory.create(story=story, index=0)

    sections = await reading_service(async_session).list_home_sections(user.id)

    assert len(sections) == 1
    assert len(sections[0].stories) == EXPECTED_SECTION_STORY_LIMIT
    assert [item.story.title for item in sections[0].stories] == [
        "story-7",
        "story-6",
        "story-5",
        "story-4",
        "story-3",
        "story-2",
    ]


async def test_get_home_given_group_without_hero_key_expect_hero_absent(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="food_dining", title="Food", order=1)
    story = await StoryFactory.create(
        reading_group=group,
        title="Only story",
        created_at=datetime(2026, 4, 1, 10, 0),
    )
    await StoryPageFactory.create(story=story, index=0)

    home = await reading_service(async_session).get_home(user.id)

    assert home.hero is None
    assert [section.group.key for section in home.sections] == ["food_dining"]
    assert [item.story.title for item in home.sections[0].stories] == ["Only story"]
