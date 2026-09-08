from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.services import public_story_filter
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate


@pytest.mark.anyio
async def test_public_story_filter_given_two_axes_expect_only_public_ready_with_pages(
    async_session: AsyncSession,
) -> None:
    group = await ReadingGroupFactory.create()

    public_ready_with_pages = await StoryFactory.create(
        reading_group=group,
        visibility=StoryVisibility.PUBLIC,
        is_ready=True,
    )
    await StoryPageFactory.create(story=public_ready_with_pages, index=0)

    public_ready_no_pages = await StoryFactory.create(
        reading_group=group,
        visibility=StoryVisibility.PUBLIC,
        is_ready=True,
    )

    public_not_ready_with_pages = await StoryFactory.create(
        reading_group=group,
        visibility=StoryVisibility.PUBLIC,
        is_ready=False,
    )
    await StoryPageFactory.create(story=public_not_ready_with_pages, index=0)

    private_ready_with_pages = await StoryFactory.create(
        reading_group=group,
        visibility=StoryVisibility.PRIVATE,
        is_ready=True,
    )
    await StoryPageFactory.create(story=private_ready_with_pages, index=0)

    visible_ids = set(
        (
            await async_session.scalars(select(Story.id).where(public_story_filter()))
        ).all()
    )
    assert visible_ids == {public_ready_with_pages.id}
    assert public_ready_no_pages.id not in visible_ids
    assert public_not_ready_with_pages.id not in visible_ids
    assert private_ready_with_pages.id not in visible_ids


@pytest.mark.anyio
async def test_save_progress_given_non_public_story_expect_rejected(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    # Ready but unpaginated is not readable.
    story = await StoryFactory.create(is_ready=True)
    await authenticate(client, user)

    response = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 0}
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.anyio
async def test_recommendations_given_non_public_seed_expect_rejected(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    # A not-ready seed story must not be addressable by UUID.
    seed = await StoryFactory.create(is_ready=False)
    await StoryPageFactory.create(story=seed, index=0)
    await authenticate(client, user)

    response = await client.get(f"/reading/stories/{seed.uuid}/recommendations")

    assert response.status_code == HTTPStatus.NOT_FOUND
