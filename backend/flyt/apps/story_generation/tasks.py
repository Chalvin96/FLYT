"""arq task for story generation.

Thin adapter, like a router: it owns the arq signature, the session, the
commits, and the dispatch fence. The pipeline — admission, budget debit,
provider call, result storage, quality measurement — lives on
``GenerationService``. No in-process scheduler or retry-in-place — a dead
generation leaves an expired slot and the learner regenerates.
"""

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.service import GenerationService
from flyt.apps.story_generation.slot import GenerationSlotStore
from flyt.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def generate_story(ctx: dict[str, Any], generation_id: int) -> None:
    slot_store = GenerationSlotStore()

    async with AsyncSessionLocal() as db:
        generation = await db.get(Generation, generation_id)
        if generation is None:
            logger.warning("Generation %s not found", generation_id)
            return

        user_id = generation.user_id
        slot = await slot_store.read(user_id)
        if (
            slot is None
            or slot.status != "processing"
            or slot.generation_id != generation_id
        ):
            return

        service = GenerationService.for_generation(db, slot_store, generation)
        try:
            dispatch = await service.prepare_generation(slot)
            if dispatch is None:
                await db.commit()
                return
            # Durable spend before dispatch: a worker death past this point must
            # not forget the debit or the claimed generation parameters.
            await db.commit()
        except asyncio.CancelledError:
            # The admission debit is final once spent; commit it so the
            # cancellation cannot silently refund it.
            await db.commit()
            raise
        except Exception:
            logger.exception("generate_story failed for generation %s", generation_id)
            await _record_failed_generation(db, service, generation)
            return

        try:
            # The finalization commit stays inside the service's shielded
            # finalization task: cancellation must not interrupt it or detach
            # it from the ready-slot publication it precedes.
            await service.dispatch_generation(*dispatch, commit=db.commit)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("generate_story failed for generation %s", generation_id)
            await _record_failed_generation(db, service, generation)


async def _record_failed_generation(
    db: AsyncSession, service: GenerationService, generation: Generation
) -> None:
    await db.rollback()
    await db.refresh(generation)
    if generation.outcome is not GenerationOutcome.PROCESSING:
        return
    await service.record_failure(
        StoryGenerationErrorCode.GENERATION_FAILED,
        "Generation failed.",
    )
    await db.commit()
