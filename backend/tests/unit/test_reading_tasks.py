import contextlib

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.queries import list_groups
from flyt.apps.reading.tokenization import PageData
from tests.factories import LemmaFactory
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import WordFormFactory


@pytest.mark.anyio
async def test_generate_story_pages_creates_annotated_pages(
    async_session: AsyncSession, monkeypatch
) -> None:
    from flyt.apps.reading import tasks

    @contextlib.asynccontextmanager
    async def _fake_session_local():
        yield async_session

    monkeypatch.setattr(tasks, "AsyncSessionLocal", _fake_session_local)

    lemma = await LemmaFactory.create()
    await WordFormFactory.create(lemma=lemma, form="katt")
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(
        reading_group=group, content="En katt.\n\nEn hund."
    )

    await tasks.generate_story_pages({}, story.id)

    pages = (
        await async_session.scalars(
            select(StoryPage)
            .where(StoryPage.story_id == story.id)
            .order_by(StoryPage.index)
        )
    ).all()
    assert len(pages) >= 1
    assert pages[0].index == 0
    assert all(isinstance(p.text_annotations_json, list) for p in pages)
    first_words = {t["word"] for t in pages[0].text_annotations_json}
    assert "katt" in first_words


@pytest.mark.anyio
async def test_generate_story_pages_is_idempotent(
    async_session: AsyncSession, monkeypatch
) -> None:
    from flyt.apps.reading import tasks

    @contextlib.asynccontextmanager
    async def _fake_session_local():
        yield async_session

    monkeypatch.setattr(tasks, "AsyncSessionLocal", _fake_session_local)

    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(reading_group=group, content="En katt.")

    await tasks.generate_story_pages({}, story.id)
    await tasks.generate_story_pages({}, story.id)

    count = len(
        (
            await async_session.scalars(
                select(StoryPage).where(StoryPage.story_id == story.id)
            )
        ).all()
    )
    assert count == 1


@pytest.mark.anyio
@pytest.mark.parametrize("is_ready", [False, True])
async def test_generate_story_pages_given_publication_request_expect_ready_only_after_pages(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch, is_ready: bool
) -> None:
    from flyt.apps.reading import tasks

    @contextlib.asynccontextmanager
    async def session_local():
        yield async_session

    monkeypatch.setattr(tasks, "AsyncSessionLocal", session_local)
    group = await ReadingGroupFactory.create()
    story = await StoryFactory.create(
        reading_group=group, content="En katt.", is_ready=False
    )

    await tasks.generate_story_pages({}, story.id, is_ready)
    await async_session.refresh(story)

    assert story.is_ready is is_ready
    assert await async_session.scalar(
        select(StoryPage.id).where(StoryPage.story_id == story.id)
    )
    groups = await list_groups(async_session)
    assert groups[0].story_count == int(is_ready)


@pytest.mark.anyio
async def test_generate_story_pages_given_empty_pagination_expect_existing_pages_preserved(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    from flyt.apps.reading import tasks

    @contextlib.asynccontextmanager
    async def session_local():
        yield async_session

    async def build_no_pages(db: AsyncSession, content: str) -> list[PageData]:
        return []

    monkeypatch.setattr(tasks, "AsyncSessionLocal", session_local)
    monkeypatch.setattr(tasks, "build_pages", build_no_pages)
    story = await StoryFactory.create(content="En katt.", is_ready=True)
    page = await StoryPageFactory.create(story=story, content="Original page.")

    with pytest.raises(ValueError, match="no pages"):
        await tasks.generate_story_pages({}, story.id)

    assert (
        await async_session.scalar(
            select(StoryPage.content).where(StoryPage.id == page.id)
        )
        == "Original page."
    )
    await async_session.refresh(story)
    assert story.is_ready is True
