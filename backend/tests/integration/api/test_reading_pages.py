import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading import queries
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory

K_EXPECTED_PAGE_COUNT = 2


@pytest.mark.anyio
async def test_get_story_page_returns_page_and_progress(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, is_ready=True)
    await StoryPageFactory.create(story=story, index=0, content="Page one.")
    await StoryPageFactory.create(story=story, index=1, content="Page two.")

    result = await queries.get_story_page(
        async_session, story.uuid, user.id, page_index=1
    )

    assert result.page.index == 1
    assert result.page.content == "Page two."
    assert result.total_pages == K_EXPECTED_PAGE_COUNT
    assert result.last_page_index == 0
    assert result.user_states == {}
