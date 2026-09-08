from contextlib import asynccontextmanager
from datetime import datetime
from datetime import timedelta
from datetime import UTC
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import flyt.commands.settle_abandoned_generations as settlement
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from tests.factories import GenerationFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


async def test_abandoned_generation_given_processing_older_than_cutoff_expect_failed(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create_async()
    generation = await GenerationFactory.create_async(
        user=user,
        created_at=_created_at_ago(2),
    )

    abandoned, users = await _run_settlement(db, monkeypatch)

    assert (abandoned, users) == (1, 1)
    assert generation.outcome is GenerationOutcome.FAILED
    assert generation.failure_code == StoryGenerationErrorCode.GENERATION_ABANDONED
    assert generation.failure_message == "Generation worker did not complete."


async def test_abandoned_generation_given_processing_younger_than_cutoff_expect_untouched(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        created_at=_created_at_ago(0.5),
    )

    abandoned, users = await _run_settlement(db, monkeypatch)

    assert (abandoned, users) == (0, 0)
    assert generation.outcome is GenerationOutcome.PROCESSING
    assert generation.failure_code is None
    assert generation.failure_message is None


async def test_abandoned_generation_given_terminal_outcome_expect_untouched(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ready = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        created_at=_created_at_ago(2),
    )
    failed = await GenerationFactory.create_async(
        outcome=GenerationOutcome.FAILED,
        failure_code=StoryGenerationErrorCode.GENERATION_FAILED,
        failure_message="Provider failed.",
        created_at=_created_at_ago(2),
    )

    abandoned, users = await _run_settlement(db, monkeypatch)

    assert (abandoned, users) == (0, 0)
    assert ready.outcome is GenerationOutcome.READY
    assert ready.failure_code is None
    assert failed.outcome is GenerationOutcome.FAILED
    assert failed.failure_code == StoryGenerationErrorCode.GENERATION_FAILED
    assert failed.failure_message == "Provider failed."


async def test_abandoned_generation_given_dry_run_expect_no_changes(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        created_at=_created_at_ago(2),
    )

    abandoned, users = await _run_settlement(db, monkeypatch, dry_run=True)

    assert (abandoned, users) == (1, 1)
    await db.refresh(generation)
    assert generation.outcome is GenerationOutcome.PROCESSING
    assert generation.failure_code is None
    assert generation.failure_message is None


async def test_abandoned_generation_given_second_run_expect_nothing_changed(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        created_at=_created_at_ago(2),
    )

    first = await _run_settlement(db, monkeypatch)
    second = await _run_settlement(db, monkeypatch)

    assert first == (1, 1)
    assert second == (0, 0)
    remaining = (
        await db.scalars(
            select(Generation).where(Generation.outcome == GenerationOutcome.PROCESSING)
        )
    ).all()
    assert generation not in remaining


def _created_at_ago(hours: float) -> datetime:
    return datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=hours)


async def _run_settlement(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    *,
    older_than_hours: float = 1,
    dry_run: bool = False,
) -> tuple[int, int]:
    @asynccontextmanager
    async def _session_local() -> AsyncIterator[AsyncSession]:
        yield db

    monkeypatch.setattr(settlement, "AsyncSessionLocal", _session_local)
    return await settlement.reconcile_abandoned_generations(
        older_than_hours=older_than_hours,
        dry_run=dry_run,
    )
