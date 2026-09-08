"""arq jobs and transaction phases for curated and imported reading."""

import logging
from typing import Any

from sqlalchemy import delete

from flyt.apps.reading.annotation import build_pages
from flyt.apps.reading.import_service import ImportService
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def generate_story_pages(ctx: dict[str, Any], story_id: int) -> None:
    """Paginate + annotate a curated story into StoryPage rows. Idempotent (replaces)."""
    async with AsyncSessionLocal() as db:
        story = await db.get(Story, story_id)
        if story is None:
            raise ValueError(f"Story {story_id} not found")

        if story.content is None:
            # Curated ingest always populates Story.content. A missing value here is
            # a data-integrity error, not an import (imports go through the
            # story-import worker, which also reads Story.content).
            raise ValueError(f"Story {story_id} has no inline content to paginate")

        pages = await build_pages(db, story.content)
        await db.execute(delete(StoryPage).where(StoryPage.story_id == story_id))
        for page in pages:
            db.add(
                StoryPage(
                    story_id=story_id,
                    index=page.index,
                    content=page.content,
                    text_annotations_json=page.tokens,
                    word_count=page.word_count,
                )
            )
        await db.commit()


async def process_import(ctx: dict[str, Any], story_id: int) -> None:
    """arq job: tokenize one imported story into pages.

    Claim (atomic, so a duplicate delivery no-ops) -> read and annotate -> publish,
    or record the failure. Claim and publish commit in separate sessions; the
    annotation phase reads source content and resolves lemmas without writes.
    """
    async with AsyncSessionLocal() as db:
        content_hash = await ImportService(db).claim_for_processing(story_id)
        if content_hash is not None:
            await db.commit()
    if content_hash is None:
        return

    try:
        async with AsyncSessionLocal() as db:
            content = await ImportService(db).content_to_process(story_id)
            if content is None:
                return  # deleted while processing
            pages = await build_pages(db, content)

        async with AsyncSessionLocal() as db:
            try:
                await ImportService(db).publish_pages(story_id, content_hash, pages)
                await db.commit()
            except Exception:
                try:
                    await db.rollback()
                except Exception:
                    logger.exception(
                        "failed to roll back publication for story %s",
                        story_id,
                    )
                raise
    except Exception:
        logger.exception("process_import failed for story %s", story_id)
        await _record_import_failure(story_id)
        raise


async def _record_import_failure(story_id: int) -> None:
    """Best-effort failure recording without masking the worker's primary error."""
    try:
        async with AsyncSessionLocal() as db:
            await ImportService(db).mark_failed(story_id, "Processing failed.")
            await db.commit()
    except Exception:
        logger.exception(
            "failed to record processing failure for story %s",
            story_id,
        )
