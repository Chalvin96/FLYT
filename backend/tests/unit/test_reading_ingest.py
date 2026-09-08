import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.commands.reading_ingest import IngestError
from flyt.commands.reading_ingest import ReadingIngestService
from flyt.commands.reading_ingest import default_fetch
from flyt.core.config import settings
from tests.factories import ReadingGroupFactory

_DOC = """---
slug: dracula-ch1
title: Dracula — Chapter 1
cefr_level: B2
group: classics
is_ready: true
---
Det var en gang.
"""
EXPECTED_ENQUEUED_URL_COUNT = 2


def _service(async_session, *, fetched: str, enqueued: list) -> ReadingIngestService:
    async def _fake_fetch(url: str) -> str:
        return fetched

    async def _fake_enqueue(name: str, *args) -> None:
        enqueued.append((name, args))

    return ReadingIngestService(
        db=async_session, fetch=_fake_fetch, enqueue=_fake_enqueue
    )


@pytest.mark.anyio
async def test_ingest_creates_story_and_enqueues(async_session: AsyncSession) -> None:
    await ReadingGroupFactory.create(key="classics")
    enqueued: list = []
    service = _service(async_session, fetched=_DOC, enqueued=enqueued)

    story = await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")

    assert story.slug == "dracula-ch1"
    assert story.is_ready is True
    assert "Det var en gang." in story.content
    assert enqueued == [("generate_story_pages", (story.id,))]


@pytest.mark.anyio
async def test_ingest_rejects_duplicate_slug(async_session: AsyncSession) -> None:
    await ReadingGroupFactory.create(key="classics")
    service = _service(async_session, fetched=_DOC, enqueued=[])
    await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")

    with pytest.raises(IngestError, match="already exists"):
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")


@pytest.mark.anyio
async def test_ingest_unknown_group_fails(async_session: AsyncSession) -> None:
    service = _service(async_session, fetched=_DOC, enqueued=[])
    with pytest.raises(IngestError, match="group"):
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")


@pytest.mark.anyio
async def test_ingest_missing_required_field_fails(
    async_session: AsyncSession,
) -> None:
    await ReadingGroupFactory.create(key="classics")
    bad = "---\ntitle: No slug\ncefr_level: A1\ngroup: classics\n---\nbody"
    service = _service(async_session, fetched=bad, enqueued=[])
    with pytest.raises(IngestError, match="slug"):
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")


@pytest.mark.anyio
async def test_ingest_given_enqueue_failure_expect_story_not_ready(
    async_session: AsyncSession,
) -> None:
    await ReadingGroupFactory.create(key="classics")

    async def _fake_fetch(url: str) -> str:
        return _DOC

    async def _boom_enqueue(name: str, *args) -> None:
        raise ConnectionError("redis://secret:pass@host down")

    service = ReadingIngestService(
        db=async_session, fetch=_fake_fetch, enqueue=_boom_enqueue
    )

    # Error is sanitised (no raw Redis DSN leaked) and the story is persisted
    # not-ready so it can never appear without generated pages.
    with pytest.raises(IngestError, match="not-ready") as exc_info:
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")
    assert "secret" not in str(exc_info.value)

    from sqlalchemy import select

    from flyt.apps.reading.models import Story

    story = await async_session.scalar(select(Story).where(Story.slug == "dracula-ch1"))
    assert story is not None
    assert story.is_ready is False


# ── default_fetch ───────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_default_fetch_given_http_url_expect_ingest_error() -> None:
    with pytest.raises(IngestError, match="https"):
        await default_fetch("http://example.com/file.md")


@pytest.mark.anyio
async def test_default_fetch_given_unreachable_url_expect_ingest_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import httpx

    async def _raise(self, *args, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx.AsyncClient, "get", _raise)

    with pytest.raises(IngestError, match="Failed to fetch"):
        await default_fetch("https://example.com/file.md")


@pytest.mark.anyio
async def test_default_fetch_given_oversize_response_expect_ingest_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    oversized_content = "x" * (settings.READING_INGEST_MAX_BYTES + 1)
    import httpx

    class MockResponse:
        content = oversized_content.encode("utf-8")
        text = oversized_content
        status_code = 200

        def raise_for_status(self) -> None:
            pass

    class MockClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, url):
            return MockResponse()

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_: MockClient())

    with pytest.raises(IngestError, match="max ingest size"):
        await default_fetch("https://example.com/file.md")


# ── ingest_from_url edge cases ──────────────────────────────────────────────


@pytest.mark.anyio
async def test_ingest_given_empty_body_fails(async_session: AsyncSession) -> None:
    await ReadingGroupFactory.create(key="classics")
    bad = "---\nslug: empty\ntitle: Empty\ncefr_level: A1\ngroup: classics\n---\n\n"
    service = _service(async_session, fetched=bad, enqueued=[])

    with pytest.raises(IngestError, match="empty"):
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")


@pytest.mark.anyio
async def test_ingest_given_blank_required_field_fails(
    async_session: AsyncSession,
) -> None:
    await ReadingGroupFactory.create(key="classics")
    bad = "---\nslug: ' '\ntitle: Blank\ncefr_level: A1\ngroup: classics\n---\nbody\n"
    service = _service(async_session, fetched=bad, enqueued=[])

    with pytest.raises(IngestError, match="slug"):
        await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")


@pytest.mark.anyio
async def test_ingest_given_no_ready_flag_expect_is_ready_false(
    async_session: AsyncSession,
) -> None:
    await ReadingGroupFactory.create(key="classics")
    # No is_ready field in front-matter: defaults to False.
    doc = "---\nslug: default-off\ntitle: Default\ncefr_level: A1\ngroup: classics\n---\nbody\n"
    enqueued: list = []
    service = _service(async_session, fetched=doc, enqueued=enqueued)

    story = await service.ingest_from_url("https://raw.githubusercontent.com/x/y/z.md")

    assert story.is_ready is False


# ── _run ─────────────────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_run_returns_count_of_successful_ingests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.commands import reading_ingest as ingest_mod

    call_count = 0

    async def fake_ingest(self, url):
        nonlocal call_count
        call_count += 1
        from unittest.mock import MagicMock

        return MagicMock(id=call_count, slug=f"slug-{call_count}")

    monkeypatch.setattr(ingest_mod.ReadingIngestService, "ingest_from_url", fake_ingest)

    # _run uses AsyncSessionLocal so monkeypatch it to return a no-op context.
    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

    monkeypatch.setattr(ingest_mod, "AsyncSessionLocal", lambda: FakeSession())

    # Skip close_arq_pool's real Redis call.
    async def fake_close():
        pass

    monkeypatch.setattr(ingest_mod, "close_arq_pool", fake_close)

    result = await ingest_mod._run(
        [
            "https://example.com/1.md",
            "https://example.com/2.md",
        ]
    )

    assert result == EXPECTED_ENQUEUED_URL_COUNT
