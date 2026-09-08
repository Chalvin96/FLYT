"""Unit tests for the story-generation pipeline operations on GenerationService.

The pipeline living on the service makes its operations exercisable without
running the arq job: failure recording, provider-failure recording, and the
finalization fence after cancellation are all directly callable seams.
"""

import asyncio
import time

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.story_generation.service import GenerationService
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


class FakeSlotStore:
    """Records slot writes without Redis; the pipeline only needs the write API."""

    def __init__(self) -> None:
        self.refused: list[tuple[int, int, str, str]] = []
        self.failed: list[tuple[int, int, str, str]] = []

    async def write_refused(self, user_id, generation_id, code, message):
        self.refused.append((user_id, generation_id, code, message))

    async def write_failed(self, user_id, generation_id, code, message):
        self.failed.append((user_id, generation_id, code, message))


class FakeProvider:
    model = "test-model"

    async def model_for(self, user_id: int) -> str:
        return "test-model"


async def make_service(
    db: AsyncSession,
) -> tuple[GenerationService, FakeSlotStore, Generation]:
    user = await UserFactory.create_async()
    generation = Generation(
        user_id=user.id,
        anchor="frequency",
        requested_length=250,
        requested_targets=3,
        outcome=GenerationOutcome.PROCESSING,
    )
    db.add(generation)
    await db.flush()
    slot_store = FakeSlotStore()
    service = GenerationService.for_generation(db, slot_store, generation)
    return service, slot_store, generation


async def test_record_failure_given_refusal_code_expect_refused_outcome_and_refused_slot(
    db,
) -> None:
    """A refusal code marks the generation REFUSED and refuses the slot."""
    service, slot_store, generation = await make_service(db)

    await service.record_failure(
        StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED,
        "Weekly budget exhausted.",
    )

    assert generation.outcome is GenerationOutcome.REFUSED
    assert generation.failure_code == StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED
    assert generation.failure_message == "Weekly budget exhausted."
    assert slot_store.refused == [
        (
            generation.user_id,
            generation.id,
            StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED,
            "Weekly budget exhausted.",
        )
    ]
    assert slot_store.failed == []


async def test_record_failure_given_non_refusal_code_expect_failed_outcome_and_failed_slot(
    db,
) -> None:
    """An infrastructure code marks the generation FAILED and fails the slot."""
    service, slot_store, generation = await make_service(db)

    await service.record_failure(
        StoryGenerationErrorCode.GENERATION_FAILED,
        "Generation failed.",
    )

    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    assert slot_store.refused == []
    assert slot_store.failed == [
        (
            generation.user_id,
            generation.id,
            StoryGenerationErrorCode.GENERATION_FAILED,
            "Generation failed.",
        )
    ]


async def test_record_provider_failure_given_timeout_expect_request_row_and_failed_slot(
    db,
) -> None:
    """A ProviderFailure records the provider request row and fails the generation."""
    service, slot_store, generation = await make_service(db)
    exc = ProviderFailure(
        ProviderFailureClass.TIMEOUT,
        "boom",
        upstream_identifier="gateway_timeout",
    )

    await service._record_provider_failure(
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
    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.PROVIDER_TIMEOUT
    assert len(slot_store.failed) == 1
    assert slot_store.refused == []


async def test_wait_for_finalization_given_cancellation_expect_waiter_outlives_cancellation(
    db,
) -> None:
    """Delivering cancellation to the waiter does not abandon the finalization."""
    service, _slot_store, _generation = await make_service(db)
    release = asyncio.Event()

    async def finalize() -> None:
        await release.wait()

    finalization = asyncio.create_task(finalize())
    waiter = asyncio.create_task(
        service._wait_for_finalization_after_cancellation(finalization)
    )
    await asyncio.sleep(0)
    waiter.cancel()
    await asyncio.sleep(0)

    assert waiter.done() is False
    release.set()
    await waiter

    assert finalization.done()
    assert finalization.exception() is None
