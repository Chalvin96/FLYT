from http import HTTPStatus

import pytest
from httpx import AsyncClient

from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

K_EXPECTED_LAST_PAGE_INDEX = 2


@pytest.mark.anyio
async def test_story_detail_returns_page(client: AsyncClient) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, is_ready=True)
    await StoryPageFactory.create(story=story, index=0, content="Page one.")

    resp = await client.get(f"/reading/stories/{story.uuid}")
    assert resp.status_code == HTTPStatus.OK
    body = resp.json()
    assert body["page"]["index"] == 0
    assert body["totalPages"] == 1
    assert body["lastPageIndex"] == 0
    assert body["userStates"] == {}


@pytest.mark.anyio
async def test_save_progress_via_json_body(client: AsyncClient) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, is_ready=True)
    await StoryPageFactory.create(story=story, index=0, content="Page one.")
    await StoryPageFactory.create(story=story, index=1, content="Page two.")

    resp = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 1}
    )
    assert resp.status_code == HTTPStatus.OK

    detail = (await client.get(f"/reading/stories/{story.uuid}")).json()
    assert detail["lastPageIndex"] == 1
    assert detail["completed"] is True


@pytest.mark.anyio
async def test_save_progress_marks_single_page_story_complete(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, is_ready=True)
    await StoryPageFactory.create(story=story, index=0, content="Only page.")

    resp = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 0}
    )
    assert resp.status_code == HTTPStatus.OK

    detail = (await client.get(f"/reading/stories/{story.uuid}")).json()
    assert detail["lastPageIndex"] == 0
    assert detail["completed"] is True


@pytest.mark.anyio
async def test_backward_navigation_does_not_regress_progress(
    client: AsyncClient,
) -> None:
    # Regression test: advancing to page 2 then back to page 0 should NOT
    # regress lastPageIndex or flip completed back to false on the next visit.
    user = await UserFactory.create()
    await authenticate(client, user)
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, is_ready=True)
    await StoryPageFactory.create(story=story, index=0, content="Page one.")
    await StoryPageFactory.create(story=story, index=1, content="Page two.")
    await StoryPageFactory.create(story=story, index=2, content="Page three.")

    # Save progress to page 2 (the last page)
    resp = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 2}
    )
    assert resp.status_code == HTTPStatus.OK
    detail = (await client.get(f"/reading/stories/{story.uuid}")).json()
    assert detail["lastPageIndex"] == K_EXPECTED_LAST_PAGE_INDEX
    assert detail["completed"] is True

    # User navigates backward to page 0
    resp = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 0}
    )
    assert resp.status_code == HTTPStatus.OK

    # On next visit, resume should be at furthest-read (page 2), not regressed to 0
    detail = (await client.get(f"/reading/stories/{story.uuid}")).json()
    assert detail["lastPageIndex"] == K_EXPECTED_LAST_PAGE_INDEX, (
        "lastPageIndex should not regress on backward navigation"
    )
    assert detail["completed"] is True, "completed should not flip back to false"
