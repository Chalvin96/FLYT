from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading import import_service
from flyt.apps.reading.constants import TITLE_MAX_LENGTH
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import UserStory
from tests.factories import StoryFactory
from tests.factories import UserFactory
from tests.factories import UserStoryFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def no_enqueue(monkeypatch: pytest.MonkeyPatch) -> None:
    async def enqueue(*args) -> None:
        return None

    monkeypatch.setattr(import_service, "enqueue_job", enqueue)


async def test_rename_given_shared_import_expect_only_owner_title_changed(
    client: AsyncClient, db: AsyncSession
) -> None:
    owner = await UserFactory.create()
    other = await UserFactory.create()
    await authenticate(client, owner)
    original = (await client.post("/imports", json={"text": "En felles tekst."})).json()
    await authenticate(client, other)
    shared = (await client.post("/imports", json={"text": "En felles tekst."})).json()
    await authenticate(client, owner)

    response = await client.patch(
        f"/imports/{original['id']}", json={"title": "  Min tittel  "}
    )

    assert response.status_code == HTTPStatus.OK, response.text
    assert response.json()["title"] == "Min tittel"
    assert response.json()["storyUuid"] == original["storyUuid"]
    saved = await client.get(f"/imports/{original['id']}")
    assert saved.json()["title"] == "Min tittel"
    listed = await client.get("/imports", params={"q": "Min tittel"})
    assert [item["id"] for item in listed.json()["items"]] == [original["id"]]
    await authenticate(client, other)
    unchanged = await client.get(f"/imports/{shared['id']}")
    assert unchanged.json()["title"] == "En felles tekst."
    story = await db.scalar(select(Story).where(Story.uuid == original["storyUuid"]))
    assert story is not None
    assert story.title == "En felles tekst."


@pytest.mark.parametrize(
    "body",
    [{}, {"title": "  "}, {"title": None}, {"title": "a" * (TITLE_MAX_LENGTH + 1)}],
)
async def test_rename_given_invalid_title_expect_validation_error(
    client: AsyncClient, db: AsyncSession, body: dict
) -> None:
    owner = await UserFactory.create()
    await authenticate(client, owner)
    original = (await client.post("/imports", json={"text": "En gyldig tekst."})).json()

    response = await client.patch(f"/imports/{original['id']}", json=body)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    saved = await client.get(f"/imports/{original['id']}")
    assert saved.json()["title"] == original["title"]


async def test_rename_given_other_learner_expect_not_found(
    client: AsyncClient, db: AsyncSession
) -> None:
    owner = await UserFactory.create()
    other = await UserFactory.create()
    await authenticate(client, owner)
    original = (await client.post("/imports", json={"text": "En privat tekst."})).json()
    await authenticate(client, other)

    response = await client.patch(
        f"/imports/{original['id']}", json={"title": "Endret"}
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    association = await db.scalar(
        select(UserStory).where(UserStory.uuid == original["id"])
    )
    assert association is not None
    assert association.title is None


async def test_rename_given_public_story_expect_not_found(
    client: AsyncClient, db: AsyncSession
) -> None:
    owner = await UserFactory.create()
    story = await StoryFactory.create()
    association = await UserStoryFactory.create(user_id=owner.id, story_id=story.id)
    await authenticate(client, owner)

    response = await client.patch(
        f"/imports/{association.uuid}", json={"title": "Endret"}
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


async def test_rename_given_unauthenticated_request_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.patch(
        "/imports/00000000-0000-0000-0000-000000000658", json={"title": "Endret"}
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
