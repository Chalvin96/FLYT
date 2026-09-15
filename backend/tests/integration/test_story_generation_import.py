"""Integration tests for the generation-to-import handover.

Tests cover: the handover publishes pre-computed pages, the durable story's text
and boundaries match what the learner read, the fallback (no pages) still
succeeds via re-annotation, import at quota is refused, and generating without
importing leaves quota unchanged.
"""

from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.reading.models import ImportQuota
from flyt.apps.reading.models import ImportStatus
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def add_ready_generation(
    db: AsyncSession,
    user_id: int,
    text: str,
    pages: list[PageData] | None,
) -> Generation:
    generation = Generation(
        user_id=user_id,
        provider="openrouter",
        anchor="frequency",
        requested_length=250,
        outcome=GenerationOutcome.READY,
        text=text,
        pages=_page_payload(pages),
    )
    db.add(generation)
    await db.flush()
    return generation


async def test_import_given_ready_generation_expect_handover_with_matching_pages(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: importing a generated story hands over its prepared pages through
    the existing import path."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    text = "Det var en gang en katt.\n\nKatten het Mia."
    pages = _make_pages(text)

    await add_ready_generation(db, user.id, text, pages)

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.CREATED, resp.text
    body = resp.json()
    assert body["status"] == ImportStatus.READY.value
    assert body["wordCount"] > 0

    story_pages = (
        (
            await db.execute(
                select(StoryPage)
                .join(Story, Story.id == StoryPage.story_id)
                .where(Story.uuid == body["storyUuid"])
            )
        )
        .scalars()
        .all()
    )
    assert len(story_pages) == len(pages)
    assert story_pages[0].content == pages[0].content


async def test_import_given_mismatched_pages_expect_fallback_to_reannotation(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: handed-over pages that do not reconstruct the stored text are
    discarded — Story.content must never hold one text while the reader pages
    hold another — and the import falls back to re-annotation."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    text = "Det var en gang en katt som het Mia."
    pages = [
        PageData(
            index=0,
            content=text,
            tokens=[
                {"word": "Det", "start": 0, "end": 3, "lemmaUuid": "abc-123"},
            ],
            word_count=8,
        ),
        PageData(
            index=1,
            content="Katten var veldig snill.",
            tokens=[],
            word_count=4,
        ),
    ]

    await add_ready_generation(db, user.id, text, pages)

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.CREATED, resp.text
    body = resp.json()
    assert body["status"] == ImportStatus.PENDING.value

    story = (
        await db.execute(select(Story).where(Story.uuid == body["storyUuid"]))
    ).scalar_one()
    assert story.content == text

    story_pages = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == story.id)))
        .scalars()
        .all()
    )
    assert story_pages == []


async def test_import_given_handover_expect_immediately_ready(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: importing a prepared story does not make the learner wait for a
    second preparation."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    text = "En kort historie."
    pages = _make_pages(text)

    await add_ready_generation(db, user.id, text, pages)

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.CREATED
    body = resp.json()
    assert body["status"] == ImportStatus.READY.value
    assert body["pageCount"] == 1


async def test_import_given_no_pages_expect_fallback_succeeds(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: when the prepared pages are missing, the import still succeeds by
    preparing the story as any imported text."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    await add_ready_generation(db, user.id, "En kort historie uten sider.", None)

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.CREATED
    body = resp.json()
    assert body["wordCount"] > 0
    assert body["status"] == ImportStatus.PENDING.value


async def test_import_given_at_quota_expect_refused(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: importing a generated story at quota is refused for the same reason
    pasted text would be."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from flyt.apps.reading.constants import IMPORT_LIMIT

    user = await UserFactory.create_async()
    await authenticate(client, user)

    text = "En historie som ikke kan importeres."
    pages = _make_pages(text)

    await add_ready_generation(db, user.id, text, pages)

    await db.execute(
        pg_insert(ImportQuota)
        .values(user_id=user.id, used=IMPORT_LIMIT)
        .on_conflict_do_update(
            index_elements=[ImportQuota.user_id],
            set_={"used": IMPORT_LIMIT},
        )
    )
    await db.flush()

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert resp.json()["detail"]["code"] == "IMPORT_QUOTA_EXCEEDED"


async def test_import_given_no_ready_generation_expect_not_found(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: importing requires a ready generated story."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.NOT_FOUND


async def test_import_given_processing_generation_expect_not_found(
    client: AsyncClient, db: AsyncSession
) -> None:
    """R-006: an in-flight generation is not yet importable."""
    user = await UserFactory.create_async()
    await authenticate(client, user)

    generation = Generation(
        user_id=user.id,
        provider="openrouter",
        anchor="frequency",
        requested_length=250,
        outcome=GenerationOutcome.PROCESSING,
    )
    db.add(generation)
    await db.flush()

    resp = await client.post("/story-generation/generations/current/import", json={})

    assert resp.status_code == HTTPStatus.NOT_FOUND


@pytest.fixture(autouse=True)
def _no_import_enqueue(monkeypatch):
    async def _noop(name: str, *args):
        return None

    monkeypatch.setattr("flyt.apps.reading.import_service.enqueue_job", _noop)


def _make_pages(
    text: str = "Det var en gang en katt.\n\nKatten het Mia.",
) -> list[PageData]:
    return [
        PageData(
            index=0,
            content=text,
            tokens=[
                {"word": "Det", "start": 0, "end": 3, "lemmaUuid": None},
                {"word": "var", "start": 4, "end": 7, "lemmaUuid": None},
            ],
            word_count=len(text.split()),
        )
    ]


def _page_payload(pages: list[PageData] | None) -> list[dict] | None:
    if pages is None:
        return None
    return [
        {
            "index": p.index,
            "content": p.content,
            "tokens": p.tokens,
            "word_count": p.word_count,
        }
        for p in pages
    ]
