from contextlib import asynccontextmanager
from datetime import datetime
from datetime import timedelta
from datetime import UTC
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import flyt.commands.settle_abandoned_generations as settlement
from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from tests.factories import GenerationFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

K_EXPECTED_MASTERED_LEMMA_COUNT = 10
K_EXPECTED_LEXICAL_TOKEN_COUNT = 50
K_EXPECTED_PRODUCED_LENGTH = 6


async def test_abandoned_generation_given_processing_older_than_cutoff_expect_failed(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create_async()
    generation = await GenerationFactory.create_async(
        user=user,
        created_at=_created_at_ago(2),
    )

    abandoned, users, purged = await _run_settlement(db, monkeypatch)

    assert (abandoned, users, purged) == (1, 1, 0)
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

    abandoned, users, purged = await _run_settlement(db, monkeypatch)

    assert (abandoned, users, purged) == (0, 0, 0)
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

    abandoned, users, purged = await _run_settlement(db, monkeypatch)

    assert (abandoned, users, purged) == (0, 0, 0)
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

    abandoned, users, purged = await _run_settlement(db, monkeypatch, dry_run=True)

    assert (abandoned, users, purged) == (1, 1, 0)
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

    assert first == (1, 1, 0)
    assert second == (0, 0, 0)
    remaining = (
        await db.scalars(
            select(Generation).where(Generation.outcome == GenerationOutcome.PROCESSING)
        )
    ).all()
    assert generation not in remaining


async def test_settlement_given_expired_ready_generation_expect_content_cleared_row_kept(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The retention purge clears transient user/generated content past the
    TTL boundary while keeping the generation row, its outcome, provider, and
    quality observability."""
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        pages=[
            {
                "index": 0,
                "content": "Det var en gang en katt.",
                "tokens": [],
                "word_count": 6,
            }
        ],
        mastered_lemma_count=10,
        lexical_token_count=50,
        produced_length=6,
        created_at=_created_at_ago(2),
    )

    abandoned, users, purged = await _run_settlement(db, monkeypatch)

    assert (abandoned, users, purged) == (0, 0, 1)
    await db.refresh(generation)
    assert generation.id is not None
    assert generation.outcome is GenerationOutcome.READY
    assert generation.provider == "openrouter"
    assert generation.topic is None
    assert generation.text is None
    assert generation.pages is None
    assert generation.mastered_lemma_count == K_EXPECTED_MASTERED_LEMMA_COUNT
    assert generation.lexical_token_count == K_EXPECTED_LEXICAL_TOKEN_COUNT
    assert generation.produced_length == K_EXPECTED_PRODUCED_LENGTH


async def test_settlement_given_fresh_ready_generation_expect_content_kept(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        created_at=_created_at_ago(0.5),
    )

    abandoned, users, purged = await _run_settlement(db, monkeypatch)

    assert (abandoned, users, purged) == (0, 0, 0)
    await db.refresh(generation)
    assert generation.topic == "En dag på skolen"
    assert generation.text == "Det var en gang en katt."


async def test_settlement_given_content_dry_run_expect_content_kept(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        created_at=_created_at_ago(2),
    )

    abandoned, users, purged = await _run_settlement(db, monkeypatch, dry_run=True)

    assert (abandoned, users, purged) == (0, 0, 1)
    await db.refresh(generation)
    assert generation.topic == "En dag på skolen"
    assert generation.text == "Det var en gang en katt."


async def test_settlement_given_second_run_expect_purge_idempotent(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        created_at=_created_at_ago(2),
    )

    first = await _run_settlement(db, monkeypatch)
    second = await _run_settlement(db, monkeypatch)

    assert first == (0, 0, 1)
    assert second == (0, 0, 0)
    await db.refresh(generation)
    assert generation.text is None


async def test_settlement_given_sql_null_pages_expect_purge_idempotent(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An expired row whose pages is already SQL NULL is only rewritten for
    its remaining content; the pages column itself stays SQL NULL."""
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        created_at=_created_at_ago(2),
    )
    await db.flush()
    assert await _pages_is_sql_null(db, generation.id) is True

    first = await _run_settlement(db, monkeypatch)
    second = await _run_settlement(db, monkeypatch)

    assert first == (0, 0, 1)
    assert second == (0, 0, 0)
    assert await _pages_is_sql_null(db, generation.id) is True


async def test_settlement_given_json_null_pages_expect_purged_to_sql_null(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A JSON null pages value (readable as Python None but not SQL NULL)
    still matches the purge and is rewritten to SQL NULL, so a second run
    rewrites nothing."""
    generation = await GenerationFactory.create_async(
        outcome=GenerationOutcome.READY,
        topic="En dag på skolen",
        text="Det var en gang en katt.",
        created_at=_created_at_ago(2),
    )
    await db.flush()
    await db.execute(
        text(
            "UPDATE story_generation_generations SET pages = 'null'::json "
            "WHERE id = :id"
        ),
        {"id": generation.id},
    )
    assert await _pages_is_sql_null(db, generation.id) is False

    first = await _run_settlement(db, monkeypatch)
    second = await _run_settlement(db, monkeypatch)

    assert first == (0, 0, 1)
    assert second == (0, 0, 0)
    assert await _pages_is_sql_null(db, generation.id) is True
    await db.refresh(generation)
    assert generation.pages is None


async def _pages_is_sql_null(db: AsyncSession, generation_id: int) -> bool | None:
    return await db.scalar(
        text("SELECT pages IS NULL FROM story_generation_generations WHERE id = :id"),
        {"id": generation_id},
    )


def _created_at_ago(hours: float) -> datetime:
    return datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=hours)


async def _run_settlement(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    *,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    @asynccontextmanager
    async def _session_local() -> AsyncIterator[AsyncSession]:
        yield db

    monkeypatch.setattr(settlement, "AsyncSessionLocal", _session_local)
    return await settlement.settle_expired_generations(dry_run=dry_run)
