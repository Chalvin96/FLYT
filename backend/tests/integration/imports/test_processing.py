"""Integration tests for imported-text processing: lifecycle and recovery.

Follows the reading-worker test pattern: the worker's ``AsyncSessionLocal`` is
monkeypatched to yield the savepoint-isolated test session, and ``enqueue_job`` is
stubbed so no Redis is needed.

Imports store their raw source on ``Story.content`` (written by ingress) and their
per-page tokens inline on ``StoryPage.text_annotations_json`` — exactly like curated
stories. There is no blob layer and no fence token.
"""

import contextlib
import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import func
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading import tasks as processing
from flyt.apps.reading.constants import ERROR_CODE_PROCESSING_FAILED
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.import_text import content_hash as hash_text
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.reading.import_service import ImportService
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.core.db import AsyncSessionLocal
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import ImportQuota
from flyt.apps.reading.tokenization import PageData
from tests.factories import ImportMetaFactory

pytestmark = pytest.mark.anyio

_SAMPLE = "Hei på deg. Dette er en liten norsk tekst.\n\nEn andre paragraf her."
K_WORKER_TIMEOUT_SECONDS = 10


@pytest.fixture
def worker_session(async_session: AsyncSession, monkeypatch) -> AsyncSession:
    """Make the worker's per-phase sessions reuse the test's isolated session."""

    @contextlib.asynccontextmanager
    async def _fake_session_local():
        yield async_session

    monkeypatch.setattr(processing, "AsyncSessionLocal", _fake_session_local)
    return async_session


async def seed_pending_import(db: AsyncSession) -> ImportMeta:
    """Create a pending import with its raw source inline on Story.content."""
    normalized = normalize_text(_SAMPLE)
    digest = hash_text(normalized)
    meta = await ImportMetaFactory.create(
        content_hash=digest, status=ImportStatus.PENDING
    )
    story = await db.get(Story, meta.story_id)
    assert story is not None
    story.content = normalized
    await db.flush()
    return meta


async def test_process_import_given_pending_expect_ready_with_inline_pages(
    worker_session: AsyncSession,
) -> None:
    # Arrange
    db = worker_session
    meta = await seed_pending_import(db)

    # Act
    await processing.process_import({}, meta.story_id)

    # Assert: status ready (the readiness signal for imports), pages inline-annotated.
    await db.refresh(meta)
    assert meta.status is ImportStatus.READY
    assert meta.error_code is None
    pages = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == meta.story_id)))
        .scalars()
        .all()
    )
    assert pages
    for page in pages:
        # Imports persist tokens inline; no blob key column.
        assert page.text_annotations_json is not None
        assert page.text_annotations_json  # non-empty
        assert not hasattr(page, "annotations_blob_key")


async def test_process_import_given_missing_inline_content_expect_failed(
    worker_session: AsyncSession,
) -> None:
    # Arrange: a pending row whose Story.content is null (never written).
    db = worker_session
    meta = await ImportMetaFactory.create(status=ImportStatus.PENDING)
    await db.flush()

    # Act / Assert: raises, and the row is marked failed with a bounded reason.
    with pytest.raises(ValueError):
        await processing.process_import({}, meta.story_id)
    await db.refresh(meta)
    assert meta.status is ImportStatus.FAILED
    assert meta.error_code == ERROR_CODE_PROCESSING_FAILED


async def test_process_import_given_ready_row_expect_noop(
    worker_session: AsyncSession,
) -> None:
    # Arrange: an already-ready row; a duplicate job delivery must not reprocess.
    db = worker_session
    meta = await seed_pending_import(db)
    await processing.process_import({}, meta.story_id)
    await db.refresh(meta)
    assert meta.status is ImportStatus.READY

    # Act: deliver the job again.
    await processing.process_import({}, meta.story_id)

    # Assert: unchanged. Idempotent: pages are still present exactly once.
    await db.refresh(meta)
    assert meta.status is ImportStatus.READY
    pages = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == meta.story_id)))
        .scalars()
        .all()
    )
    assert len(pages) > 0


async def test_process_import_given_already_ready_expect_noop_no_page_rewrite(
    worker_session: AsyncSession,
) -> None:
    # Arrange: a ready import with a known page row (specific identity + content).
    db = worker_session
    meta = await seed_pending_import(db)
    await processing.process_import({}, meta.story_id)
    await db.refresh(meta)
    assert meta.status is ImportStatus.READY

    pages_before = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == meta.story_id)))
        .scalars()
        .all()
    )
    assert len(pages_before) == 1  # _SAMPLE is short enough to produce one page
    page_before_id = pages_before[0].id
    page_before_content = pages_before[0].content

    # Act: a duplicate job delivery must be refused by the atomic claim.
    await processing.process_import({}, meta.story_id)

    # Assert: the claim refused (READY), so the page row was not deleted and
    # re-inserted — same row identity, same content.
    await db.refresh(meta)
    assert meta.status is ImportStatus.READY
    pages_after = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == meta.story_id)))
        .scalars()
        .all()
    )
    assert len(pages_after) == 1
    assert pages_after[0].id == page_before_id
    assert pages_after[0].content == page_before_content


async def test_process_import_given_story_deleted_midflight_expect_noop_no_crash(
    worker_session: AsyncSession,
    monkeypatch,
) -> None:
    # Arrange: simulate a concurrent last-owner delete that lands after the claim
    # but before the final write. ``build_pages`` is the seam between the two.
    db = worker_session
    meta = await seed_pending_import(db)
    story_id = meta.story_id
    original_build_pages = processing.build_pages

    async def _delete_story_then_build(session: AsyncSession, content: str):
        story = await session.get(Story, story_id)
        if story is not None:
            await session.delete(story)
            await session.commit()  # DB cascade removes ImportMeta + StoryPage
        return await original_build_pages(session, content)

    monkeypatch.setattr(processing, "build_pages", _delete_story_then_build)

    # Act: must not raise despite the story vanishing between claim and final write.
    await processing.process_import({}, story_id)

    # Assert: the final-write guard no-oped — no pages were written for the
    # deleted story, and no exception propagated.
    pages = (
        (await db.execute(select(StoryPage).where(StoryPage.story_id == story_id)))
        .scalars()
        .all()
    )
    assert pages == []


async def seed_worker_import(content: str) -> tuple[int, int]:
    """Create a pending import plus its user in real committed sessions."""
    normalized = normalize_text(content)
    digest = hash_text(normalized)
    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email=f"worker-{uuid4().hex}@example.com",
            display_name="Worker Durability",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        story = Story(
            title="Worker durability",
            content=normalized,
            cefr_level=None,
            slug=None,
            reading_group_id=None,
            visibility=StoryVisibility.PRIVATE,
            is_ready=False,
            word_count=1,
        )
        session.add(story)
        await session.flush()
        session.add(
            ImportMeta(
                story_id=story.id,
                content_hash=digest,
                status=ImportStatus.PENDING,
            )
        )
        session.add(ImportQuota(user_id=user_id, used=1))
        await session.commit()
        return user_id, story.id


async def discard_worker_import(user_id: int, story_id: int) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            sa_delete(StoryPage).where(StoryPage.story_id == story_id)
        )
        await session.execute(sa_delete(Story).where(Story.id == story_id))
        await session.execute(
            sa_delete(ImportQuota).where(ImportQuota.user_id == user_id)
        )
        await session.execute(sa_delete(User).where(User.id == user_id))
        await session.commit()


async def durable_status(story_id: int) -> ImportStatus:
    async with AsyncSessionLocal() as verify:
        meta = await verify.scalar(
            select(ImportMeta).where(ImportMeta.story_id == story_id)
        )
    assert meta is not None
    return meta.status


async def test_process_import_given_crash_during_tokenization_expect_claim_stays_durable(
    setup_database: None,
    monkeypatch,
) -> None:
    """The claim phase commits before tokenization, so a hard worker death
    leaves PROCESSING durable rather than rolling the claim back to PENDING."""

    async def crash(session: AsyncSession, content: str):
        raise KeyboardInterrupt

    monkeypatch.setattr(processing, "build_pages", crash)
    user_id, story_id = await seed_worker_import(_SAMPLE)
    try:
        with pytest.raises(KeyboardInterrupt):
            await asyncio.wait_for(
                processing.process_import({}, story_id),
                timeout=K_WORKER_TIMEOUT_SECONDS,
            )

        assert await durable_status(story_id) is ImportStatus.PROCESSING
    finally:
        await discard_worker_import(user_id, story_id)


async def test_process_import_given_failed_tokenization_expect_failure_recorded_durable(
    setup_database: None,
    monkeypatch,
) -> None:
    """The failure phase commits its own session, so the FAILED marking
    survives the job's re-raise."""

    async def fail(session: AsyncSession, content: str):
        raise RuntimeError("tokenizer exploded")

    monkeypatch.setattr(processing, "build_pages", fail)
    user_id, story_id = await seed_worker_import(_SAMPLE)
    try:
        with pytest.raises(RuntimeError):
            await asyncio.wait_for(
                processing.process_import({}, story_id),
                timeout=K_WORKER_TIMEOUT_SECONDS,
            )

        assert await durable_status(story_id) is ImportStatus.FAILED
    finally:
        await discard_worker_import(user_id, story_id)


async def test_process_import_given_failed_publication_expect_failure_recorded_durable(
    setup_database: None,
    monkeypatch,
) -> None:
    """A publication failure rolls back partial writes and records FAILED."""

    original_publish_pages = ImportService.publish_pages

    async def fail_after_publication(
        self: ImportService,
        story_id: int,
        content_hash: str,
        pages: list[PageData],
    ) -> None:
        await original_publish_pages(self, story_id, content_hash, pages)
        raise RuntimeError("publication exploded")

    monkeypatch.setattr(ImportService, "publish_pages", fail_after_publication)
    user_id, story_id = await seed_worker_import(_SAMPLE)
    try:
        with pytest.raises(RuntimeError, match="publication exploded"):
            await asyncio.wait_for(
                processing.process_import({}, story_id),
                timeout=K_WORKER_TIMEOUT_SECONDS,
            )

        assert await durable_status(story_id) is ImportStatus.FAILED
        async with AsyncSessionLocal() as verify:
            page_count = await verify.scalar(
                select(func.count())
                .select_from(StoryPage)
                .where(StoryPage.story_id == story_id)
            )
        assert page_count == 0
    finally:
        await discard_worker_import(user_id, story_id)


async def test_process_import_given_success_expect_ready_committed(
    setup_database: None,
    monkeypatch,
) -> None:
    """The publish phase commits, so READY and its pages are durable once the
    job returns."""
    from flyt.apps.reading.tokenization import PageData

    published = [
        PageData(index=0, content=normalize_text(_SAMPLE), tokens=[], word_count=9)
    ]

    async def fake_build_pages(session: AsyncSession, content: str):
        return published

    monkeypatch.setattr(processing, "build_pages", fake_build_pages)
    user_id, story_id = await seed_worker_import(_SAMPLE)
    try:
        await asyncio.wait_for(
            processing.process_import({}, story_id),
            timeout=K_WORKER_TIMEOUT_SECONDS,
        )

        assert await durable_status(story_id) is ImportStatus.READY
        async with AsyncSessionLocal() as verify:
            page_count = await verify.scalar(
                select(func.count())
                .select_from(StoryPage)
                .where(StoryPage.story_id == story_id)
            )
        assert page_count == 1
    finally:
        await discard_worker_import(user_id, story_id)
