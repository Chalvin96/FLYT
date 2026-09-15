"""Unit tests for the story-generation pipeline operations on GenerationExecution.

The pipeline living on the execution module makes its operations exercisable
without running the arq job: failure recording, provider-failure recording,
the conditional worker claim, and the finalization fence after cancellation
are all directly callable seams.
"""

import asyncio
import time
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.execution import GenerationExecution
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.core.config import settings
from flyt.libs.utils.date import now
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


class FakeProvider:
    model = "test-model"

    async def model_for(self, user_id: int) -> str:
        return "test-model"


async def make_execution(
    db: AsyncSession,
) -> tuple[GenerationExecution, Generation]:
    user = await UserFactory.create_async()
    generation = Generation(
        user_id=user.id,
        provider="openrouter",
        anchor="frequency",
        requested_length=250,
        requested_targets=3,
        outcome=GenerationOutcome.PROCESSING,
    )
    db.add(generation)
    await db.flush()
    execution = GenerationExecution(db, generation)
    return execution, generation


async def refresh_outcome(db: AsyncSession, generation: Generation) -> Generation:
    await db.refresh(generation)
    return generation


async def test_record_failure_given_refusal_code_expect_refused_outcome(
    db,
) -> None:
    """A refusal code marks the generation REFUSED."""
    execution, generation = await make_execution(db)

    await execution.record_failure(
        StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED,
        "Weekly budget exhausted.",
    )

    refreshed = await refresh_outcome(db, generation)
    assert refreshed.outcome is GenerationOutcome.REFUSED
    assert refreshed.failure_code == StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED
    assert refreshed.failure_message == "Weekly budget exhausted."


async def test_record_failure_given_non_refusal_code_expect_failed_outcome(
    db,
) -> None:
    """An infrastructure code marks the generation FAILED."""
    execution, generation = await make_execution(db)

    await execution.record_failure(
        StoryGenerationErrorCode.GENERATION_FAILED,
        "Generation failed.",
    )

    refreshed = await refresh_outcome(db, generation)
    assert refreshed.outcome is GenerationOutcome.FAILED
    assert refreshed.failure_code == StoryGenerationErrorCode.GENERATION_FAILED


async def test_record_failure_given_superseded_generation_expect_write_discarded(
    db,
) -> None:
    """A superseded generation already carries its abandonment failure, so a
    late failure write must not overwrite it."""
    execution, generation = await make_execution(db)
    generation.outcome = GenerationOutcome.FAILED
    generation.failure_code = StoryGenerationErrorCode.GENERATION_ABANDONED
    await db.flush()

    await execution.record_failure(
        StoryGenerationErrorCode.GENERATION_FAILED,
        "Generation failed.",
    )

    refreshed = await refresh_outcome(db, generation)
    assert refreshed.outcome is GenerationOutcome.FAILED
    assert refreshed.failure_code == StoryGenerationErrorCode.GENERATION_ABANDONED


async def test_claim_given_processing_generation_expect_claimed_once(
    db,
) -> None:
    """Only one overlapping worker may own a processing generation."""
    execution, generation = await make_execution(db)

    assert await execution._claim_generation() is not None
    await db.flush()

    second = GenerationExecution(db, generation)
    assert await second._claim_generation() is None


async def test_claim_given_superseded_generation_expect_no_claim(
    db,
) -> None:
    execution, generation = await make_execution(db)
    generation.outcome = GenerationOutcome.FAILED
    await db.flush()

    assert await execution._claim_generation() is None


async def test_claim_given_stale_generation_expect_no_claim(
    db,
) -> None:
    """Worker admission shares the polling retention cutoff: a row created
    before it cannot be claimed, so it is never debited or dispatched."""
    execution, generation = await make_execution(db)
    generation.created_at = now() - timedelta(
        hours=settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS + 1
    )
    await db.flush()

    assert await execution._claim_generation() is None


async def test_record_provider_failure_given_timeout_expect_request_row_and_failed_outcome(
    db,
) -> None:
    """A ProviderFailure records the provider request row and fails the generation."""
    execution, generation = await make_execution(db)
    exc = ProviderFailure(
        ProviderFailureClass.TIMEOUT,
        "boom",
        upstream_identifier="gateway_timeout",
    )

    await execution._record_provider_failure(
        FakeProvider(), "openrouter", exc, time.monotonic()
    )

    request = (
        await db.execute(
            select(ProviderRequest).where(
                ProviderRequest.generation_id == generation.id
            )
        )
    ).scalar_one()
    assert request.outcome is ProviderRequestOutcome.FAILURE
    assert request.provider == "openrouter"
    assert request.model == "test-model"
    assert request.failure_class == "timeout"
    assert request.upstream_identifier == "gateway_timeout"
    refreshed = await refresh_outcome(db, generation)
    assert refreshed.outcome is GenerationOutcome.FAILED
    assert refreshed.failure_code == StoryGenerationErrorCode.PROVIDER_TIMEOUT


async def test_wait_for_finalization_given_cancellation_expect_waiter_outlives_cancellation(
    db,
) -> None:
    """Delivering cancellation to the waiter does not abandon the finalization."""
    execution, _generation = await make_execution(db)
    release = asyncio.Event()

    async def finalize() -> None:
        await release.wait()

    finalization = asyncio.create_task(finalize())
    waiter = asyncio.create_task(
        execution._wait_for_finalization_after_cancellation(finalization)
    )
    await asyncio.sleep(0)
    waiter.cancel()
    await asyncio.sleep(0)

    assert waiter.done() is False
    release.set()
    await waiter

    assert finalization.done()
    assert finalization.exception() is None
