"""CLI: ingest reading stories by URL (markdown + YAML front-matter).

Usage:  cd backend && uv run python -m flyt.commands.reading_ingest <url> [<url> ...]
Requires REDIS_URL (to enqueue) and DATABASE_URL.

Content is immutable: a duplicate slug is rejected (delete-to-replace). The fetch
is injected so it can be unit-tested and so URL-fetch policy lives in one place
(default_fetch).
"""

import argparse
import asyncio
import sys
from typing import Any
from collections.abc import Awaitable
from collections.abc import Callable
from urllib.parse import urlparse

import frontmatter
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal
from flyt.core.queue import close_arq_pool
from flyt.core.queue import enqueue_job

_REQUIRED_FIELDS = ("slug", "title", "cefr_level", "group")

Fetch = Callable[[str], Awaitable[str]]
Enqueue = Callable[..., Awaitable[None]]


class IngestError(Exception):
    """Raised for any ingestion failure (clear, operator-facing message)."""


async def default_fetch(url: str) -> str:
    """Fetch a URL with a simple policy: https-only, size limit, timeout."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise IngestError(f"URL must be https: {url}")
    try:
        async with httpx.AsyncClient(
            timeout=settings.READING_INGEST_TIMEOUT_SECONDS, follow_redirects=False
        ) as client:
            response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise IngestError(f"Failed to fetch {url}: {exc}") from exc
    if len(response.content) > settings.READING_INGEST_MAX_BYTES:
        raise IngestError("File exceeds max ingest size")
    return response.text


class ReadingIngestService:
    def __init__(
        self,
        db: AsyncSession,
        fetch: Fetch = default_fetch,
        enqueue: Enqueue = enqueue_job,
    ) -> None:
        self.db = db
        self.fetch = fetch
        self.enqueue = enqueue

    async def ingest_from_url(self, url: str) -> Story:
        raw = await self.fetch(url)
        post = frontmatter.loads(raw)
        meta: dict[str, Any] = post.metadata
        body = post.content.strip()

        for field in _REQUIRED_FIELDS:
            if not (meta.get(field) or "").strip():
                raise IngestError(f"Missing required front-matter field: {field}")
        if not body:
            raise IngestError("Story body is empty")

        existing = await self.db.scalar(
            select(Story.id).where(Story.slug == meta["slug"])
        )
        if existing is not None:
            raise IngestError(
                f"Story slug '{meta['slug']}' already exists; delete it first to replace"
            )

        group = await self.db.scalar(
            select(ReadingGroup).where(ReadingGroup.key == meta["group"])
        )
        if group is None:
            raise IngestError(f"Unknown reading group: {meta['group']}")

        story = Story(
            slug=meta["slug"],
            title=meta["title"],
            cefr_level=meta["cefr_level"],
            reading_group_id=group.id,
            visibility=StoryVisibility.PUBLIC,
            is_ready=bool(meta.get("is_ready")),
            content=body,
            word_count=len(body.split()),
        )
        self.db.add(story)
        await self.db.commit()
        await self.db.refresh(story)

        try:
            await self.enqueue("generate_story_pages", story.id)
        except Exception as exc:
            # The story is committed but has no pages yet. Force it not-ready and raise a
            # sanitised error (never surface the raw Redis DSN to the operator).
            story.is_ready = False
            await self.db.commit()
            raise IngestError(
                f"Could not enqueue annotation job (is Redis reachable?); "
                f"story '{story.slug}' was saved not-ready"
            ) from exc
        return story


async def _run(urls: list[str]) -> int:
    created = 0
    async with AsyncSessionLocal() as db:
        service = ReadingIngestService(db=db)
        for url in urls:
            try:
                story = await service.ingest_from_url(url)
                print(f"Ingested '{story.slug}' (id={story.id}); annotation enqueued")
                created += 1
            except IngestError as exc:
                print(f"SKIP {url}: {exc}", file=sys.stderr)
    await close_arq_pool()
    return created


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+")
    args = parser.parse_args()
    created = asyncio.run(_run(args.urls))
    print(f"Done. {created} ingested.")


if __name__ == "__main__":
    main()
