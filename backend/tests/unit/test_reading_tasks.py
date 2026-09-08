import contextlib

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import StoryPage
from tests.factories import LemmaFactory
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
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
