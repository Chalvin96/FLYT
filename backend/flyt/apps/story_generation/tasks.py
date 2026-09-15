"""Run one story generation job."""

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.execution import GenerationExecution
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def generate_story(ctx: dict[str, Any], generation_id: int) -> None:
    async with AsyncSessionLocal() as db:
        generation = await db.get(Generation, generation_id)
        if generation is None or generation.outcome is not GenerationOutcome.PROCESSING:
            if generation is None:
                logger.warning("Generation %s not found", generation_id)
            return

        execution = GenerationExecution(db, generation)
        try:
            dispatch = await execution.prepare_generation()
            if dispatch is None:
                await db.commit()
                return
            await db.commit()
        except asyncio.CancelledError:
            await db.commit()
            raise
        except Exception:
            logger.exception("generate_story failed for generation %s", generation_id)
            await _record_failed_generation(db, execution, generation)
            return

        try:
            await execution.dispatch_generation(*dispatch, commit=db.commit)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("generate_story failed for generation %s", generation_id)
            await _record_failed_generation(db, execution, generation)


async def _record_failed_generation(
    db: AsyncSession, execution: GenerationExecution, generation: Generation
) -> None:
    await db.rollback()
    await db.refresh(generation)
    if generation.outcome is not GenerationOutcome.PROCESSING:
        return
    await execution.record_failure(
        StoryGenerationErrorCode.GENERATION_FAILED,
        "Generation failed.",
        claimed=generation.worker_claim,
    )
    await db.commit()
