from datetime import datetime
from uuid import UUID

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading import queries
from flyt.apps.reading.exceptions import ReadingNotFoundError
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.router import get_home
from flyt.apps.reading.router import get_hero
from flyt.apps.reading.router import get_stories
from flyt.apps.reading.router import get_story
from flyt.apps.reading.router import get_story_recommendations
from flyt.apps.users.models import User
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory
from tests.factories import UserStoryFactory
from tests.helpers.sql_log import capture_sql

pytestmark = pytest.mark.anyio

EXPECTED_SECTION_STORY_LIMIT = 6
EXPECTED_OVER_LIMIT_SEED_STORY_COUNT = 8
EXPECTED_FEWER_SEED_STORY_COUNT = 2
EXPECTED_HOME_QUERY_COUNT = 3
EXPECTED_GROUP_QUERY_COUNT = 4
EXPECTED_STORY_PAGE_QUERY_COUNT = 4
EXPECTED_STORY_PAGE_COUNT = 3
LAST_STORY_PAGE_INDEX = 2
GAPPED_STORY_SECOND_PAGE_INDEX = 2
GAPPED_STORY_PAGE_COUNT = 2
SUMMARY_SURFACES = ("home", "group", "hero", "recommendations")
SUMMARY_QUERY_COUNTS = {
    "home": EXPECTED_HOME_QUERY_COUNT,
    "group": EXPECTED_GROUP_QUERY_COUNT,
    "hero": 1,
    "recommendations": 2,
}


async def seed_summary_surface(session: AsyncSession) -> tuple[User, str, UUID]:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="daily_life", title="Daily Life")
    seed = await StoryFactory.create(reading_group=group, content="Seed story.")
    story = await StoryFactory.create(
        reading_group=group,
        title="Selected story",
        content="w " * 19 + "z" * 2048,
    )
    await StoryPageFactory.create(story=seed)
    await StoryPageFactory.create(story=story)
    group_key = group.key
    seed_uuid = seed.uuid
    session.expunge_all()
    return user, group_key, seed_uuid


async def summary_from_surface(
    session: AsyncSession,
    user: User,
    group_key: str,
    seed_story_uuid: UUID,
    surface: str,
) -> str:
    if surface == "home":
        response = await get_home(current_user=user, db=session)
        assert response.todaysStory is not None
        assert response.todaysStory.groupTitle == "Daily Life"
        assert response.sections[0].stories[0].title == response.todaysStory.title
        return response.todaysStory.title
    if surface == "group":
        response = await get_stories(
            group_key=group_key,
            current_user=user,
            db=session,
            limit=20,
            cursor=None,
            levels=None,
            show_read=True,
        )
        return response.stories[0].title
    if surface == "hero":
        response = await get_hero(db=session)
        assert response.todaysStory is not None
        return response.todaysStory.title
    if surface == "recommendations":
        response = await get_story_recommendations(
            story_uuid=seed_story_uuid,
            current_user=user,
            db=session,
            limit=3,
        )
        return response.stories[0].title
    raise ValueError(f"Unknown summary surface: {surface}")


@pytest.mark.parametrize("surface", SUMMARY_SURFACES)
async def test_summary_given_fresh_session_expect_no_content_query(
    async_session: AsyncSession,
    surface: str,
) -> None:
    user, group_key, seed_uuid = await seed_summary_surface(async_session)

    with capture_sql(async_session) as executed:
        title = await summary_from_surface(
            async_session, user, group_key, seed_uuid, surface
        )

    assert title == "Selected story"
    assert len(executed) == SUMMARY_QUERY_COUNTS[surface]
    assert all(
        "reading_stories.content" not in statement
        for statement, _ in executed
        if statement.startswith("SELECT")
    )


async def test_get_home_given_no_groups_expect_empty_sections_and_no_hero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    home = await queries.get_home(async_session, user.id)

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

    sections = await queries.list_home_sections(async_session, user.id)

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

    sections = await queries.list_home_sections(async_session, user.id)

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

    home = await queries.get_home(async_session, user.id)

    assert home.hero is None
    assert [section.group.key for section in home.sections] == ["food_dining"]
    assert [item.story.title for item in home.sections[0].stories] == ["Only story"]


async def test_get_story_page_given_fresh_session_expect_one_ordered_page_row_and_clamping(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="pages", title="Pages")
    story = await StoryFactory.create(reading_group=group)
    for index in range(EXPECTED_STORY_PAGE_COUNT):
        await StoryPageFactory.create(
            story=story, index=index, content=f"Page {index}."
        )
    await UserStoryFactory.create(
        user=user, story=story, last_page_index=LAST_STORY_PAGE_INDEX
    )
    story_uuid = story.uuid
    async_session.expunge_all()

    with capture_sql(async_session) as executed:
        beyond = await get_story(
            story_uuid=story_uuid,
            current_user=user,
            db=async_session,
            page=99,
        )

    page_rows = [
        statement
        for statement, _ in executed
        if "reading_story_pages.content" in statement
    ]
    assert len(executed) == EXPECTED_STORY_PAGE_QUERY_COUNT
    assert len(page_rows) == 1
    assert "ORDER BY reading_story_pages.index" in page_rows[0]
    assert "LIMIT" in page_rows[0]
    assert "OFFSET" in page_rows[0]
    assert beyond.page.index == LAST_STORY_PAGE_INDEX
    assert beyond.page.content == "Page 2."
    assert beyond.totalPages == EXPECTED_STORY_PAGE_COUNT
    assert beyond.lastPageIndex == LAST_STORY_PAGE_INDEX
    assert beyond.groupKey == "pages"
    async_session.expunge_all()

    last_page = await get_story(
        story_uuid=story_uuid,
        current_user=user,
        db=async_session,
        page=None,
    )
    first_page = await get_story(
        story_uuid=story_uuid,
        current_user=user,
        db=async_session,
        page=-1,
    )

    assert last_page.page.index == LAST_STORY_PAGE_INDEX
    assert first_page.page.index == 0


async def test_get_story_page_given_gapped_indexes_expect_position_and_stored_index(
    async_session: AsyncSession,
) -> None:
    last_page_index = 5
    user = await UserFactory.create()
    story = await StoryFactory.create()
    await StoryPageFactory.create(story=story, index=0, content="First page.")
    await StoryPageFactory.create(
        story=story, index=GAPPED_STORY_SECOND_PAGE_INDEX, content="Second page."
    )
    await UserStoryFactory.create(
        user=user, story=story, last_page_index=last_page_index
    )
    story_uuid = story.uuid
    async_session.expunge_all()

    second_page = await get_story(
        story_uuid=story_uuid,
        current_user=user,
        db=async_session,
        page=1,
    )
    assert second_page.page.index == GAPPED_STORY_SECOND_PAGE_INDEX
    assert second_page.page.content == "Second page."
    assert second_page.totalPages == GAPPED_STORY_PAGE_COUNT
    assert second_page.lastPageIndex == last_page_index

    beyond = await get_story(
        story_uuid=story_uuid,
        current_user=user,
        db=async_session,
        page=5,
    )
    resumed = await get_story(
        story_uuid=story_uuid,
        current_user=user,
        db=async_session,
        page=None,
    )

    assert beyond.page.index == GAPPED_STORY_SECOND_PAGE_INDEX
    assert beyond.page.content == "Second page."
    assert beyond.lastPageIndex == last_page_index
    assert resumed.page.index == GAPPED_STORY_SECOND_PAGE_INDEX
    assert resumed.lastPageIndex == last_page_index


async def test_get_story_page_given_pages_deleted_after_count_expect_not_found(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    story = await StoryFactory.create()
    await StoryPageFactory.create(story=story, index=0)
    original_scalar = async_session.scalar

    async def scalar_with_deleted_pages(statement):
        result = await original_scalar(statement)
        if isinstance(result, int):
            await async_session.execute(
                delete(StoryPage).where(StoryPage.story_id == story.id)
            )
        return result

    monkeypatch.setattr(async_session, "scalar", scalar_with_deleted_pages)

    with pytest.raises(ReadingNotFoundError, match="Story has no pages"):
        await queries.get_story_page(async_session, story.uuid, user.id)
