"""Integration tests for the reader/API contract for imported stories (C-06).

Imports reuse the reading reader endpoints. The contract: an owner reads their
import with inline tokens (no blob fetch) and null level/group; a non-owner is
denied with 404 (never a signal it exists); a not-ready import returns 409; and
imports never leak into curated lists.
"""

import json
from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import ImportStatus
from tests.factories import ImportMetaFactory
from tests.factories import UserFactory
from tests.factories import UserStoryFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def _ready_import_with_page(
    db: AsyncSession, *, tokens: list[dict]
) -> tuple[int, str]:
    """Create a ready import with one inline-annotated page. Returns (story_id, uuid)."""
    meta = await ImportMetaFactory.create(status=ImportStatus.READY)
    story = await db.get(Story, meta.story_id)
    assert story is not None
    story.is_ready = True
    db.add(
        StoryPage(
            story_id=meta.story_id,
            index=0,
            content="Hei på deg",
            text_annotations_json=tokens,
            word_count=3,
        )
    )
    await db.flush()
    return meta.story_id, str(story.uuid)


async def test_reader_given_owner_expect_inline_tokens_and_null_group(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    user = await UserFactory.create()
    story_id, story_uuid = await _ready_import_with_page(
        db, tokens=[{"word": "Hei", "start": 0, "end": 3, "lemmaUuid": None}]
    )
    await UserStoryFactory.create(user_id=user.id, story_id=story_id)
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.get(f"/reading/stories/{story_uuid}")

    # Assert: readable, level/group null, tokens served inline.
    assert resp.status_code == HTTPStatus.OK, resp.text
    body = resp.json()
    assert body["cefrLevel"] is None
    assert body["groupKey"] is None and body["groupTitle"] is None
    assert body["page"]["tokens"][0]["word"] == "Hei"


async def test_reader_given_non_owner_expect_404_no_leak(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: owner has the import; a stranger requests it.
    owner = await UserFactory.create()
    stranger = await UserFactory.create()
    story_id, story_uuid = await _ready_import_with_page(db, tokens=[])
    await UserStoryFactory.create(user_id=owner.id, story_id=story_id)
    await db.flush()
    await authenticate(client, stranger)

    # Act
    resp = await client.get(f"/reading/stories/{story_uuid}")

    # Assert: 404 (not 403) with no story metadata.
    assert resp.status_code == HTTPStatus.NOT_FOUND
    assert "title" not in resp.json()


async def test_reader_given_not_ready_import_expect_409(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: an owned import still processing.
    user = await UserFactory.create()
    meta = await ImportMetaFactory.create(status=ImportStatus.PROCESSING)
    story = await db.get(Story, meta.story_id)
    assert story is not None
    await UserStoryFactory.create(user_id=user.id, story_id=meta.story_id)
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.get(f"/reading/stories/{story.uuid}")

    # Assert
    assert resp.status_code == HTTPStatus.CONFLICT
    assert resp.json()["detail"]["code"] == "IMPORT_NOT_READY"


async def test_reader_progress_given_non_owner_expect_404(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange
    owner = await UserFactory.create()
    stranger = await UserFactory.create()
    story_id, story_uuid = await _ready_import_with_page(db, tokens=[])
    await UserStoryFactory.create(user_id=owner.id, story_id=story_id)
    await db.flush()
    await authenticate(client, stranger)

    # Act: a non-owner tries to write progress.
    resp = await client.post(
        f"/reading/stories/{story_uuid}/progress", json={"pageIndex": 0}
    )

    # Assert
    assert resp.status_code == HTTPStatus.NOT_FOUND


async def test_reader_recommendations_given_owner_private_import_expect_200(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: an owner opens their own ready private import. Recommendations must
    # authorize the seed like a reader (not gate it on the public filter), so this
    # is 200 — a ready owned import is not "not found".
    user = await UserFactory.create()
    story_id, story_uuid = await _ready_import_with_page(db, tokens=[])
    await UserStoryFactory.create(user_id=user.id, story_id=story_id)
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.get(f"/reading/stories/{story_uuid}/recommendations")

    # Assert: authorized (200), not a 404 from the public-only seed lookup.
    assert resp.status_code == HTTPStatus.OK, resp.text


async def test_reader_given_userstory_title_expect_owner_title_override(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: the owner's UserStory carries a display title distinct from the
    # shared Story.title; the reader must return the owner-scoped override.
    user = await UserFactory.create()
    story_id, story_uuid = await _ready_import_with_page(db, tokens=[])
    story = await db.get(Story, story_id)
    assert story is not None
    story.title = "Shared story title"
    await UserStoryFactory.create(
        user_id=user.id, story_id=story_id, title="My import title"
    )
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.get(f"/reading/stories/{story_uuid}")

    # Assert
    assert resp.status_code == HTTPStatus.OK, resp.text
    assert resp.json()["title"] == "My import title"


async def test_curated_list_given_ready_import_expect_excluded(
    client: AsyncClient, db: AsyncSession
) -> None:
    # Arrange: a ready import (published, has pages) must not appear in curated home.
    user = await UserFactory.create()
    story_id, _uuid = await _ready_import_with_page(db, tokens=[])
    await UserStoryFactory.create(user_id=user.id, story_id=story_id)
    await db.flush()
    await authenticate(client, user)

    # Act
    resp = await client.get("/reading/home")

    # Assert: the import's story uuid is absent from every curated section.
    assert resp.status_code == HTTPStatus.OK
    body = json.dumps(resp.json())
    import_story = await db.get(Story, story_id)
    assert import_story is not None
    assert str(import_story.uuid) not in body
