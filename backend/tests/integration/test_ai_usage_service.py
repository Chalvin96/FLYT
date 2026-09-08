"""Integration tests for Flyt AI token stock."""

import asyncio
from datetime import date
from datetime import datetime
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.constants import K_AI_USAGE_ESTIMATION_OVERHEAD_TOKENS
from flyt.apps.ai_usage.models import FlytAiAggregateUsage
from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.types import AggregateUsageScope
from flyt.apps.ai_usage.types import AiUsageRefusalReason
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.ai_usage.types import AiUsageStatus
from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.apps.ai_usage.window import calculate_utc_window_start
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal
from flyt.libs.utils.date import now
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

K_TEST_CONSUME = 400
K_TEST_SNAPSHOT_BUDGET = 100_000
K_TEST_AGGREGATE_BUDGET = 10_000
K_TEST_REMAINING_PERCENT = 75
K_CONCURRENCY = 5
K_TEST_WINDOW_START = datetime(2026, 1, 1)
K_TEST_PRE_DEBIT_NAME = "Renamed before debit"
K_TEST_POST_COMMIT_NAME = "Renamed after commit"
K_TEST_REQUEST = AiUsageRequest(
    instructions="You are Flyt's chatbot.",
    prompt="Hvorfor er det «en bok»?",
    max_tokens=2_000,
)
K_TEST_REQUEST_ESTIMATE = (
    len(K_TEST_REQUEST.instructions.encode("utf-8"))
    + len(K_TEST_REQUEST.prompt.encode("utf-8"))
    + K_AI_USAGE_ESTIMATION_OVERHEAD_TOKENS
    + (K_TEST_REQUEST.max_tokens or 0)
)


async def create_usage_row(
    db: AsyncSession,
    user_id: int,
    remaining: int,
    budget: int,
    period_start: date | None = None,
) -> None:
    db.add(
        FlytAiUsage(
            user_id=user_id,
            period_start=period_start or calculate_utc_week_start(),
            remaining_tokens=remaining,
            budget_tokens=budget,
        )
    )
    await db.flush()


def get_aggregate_scope(
    provider: str = "openrouter",
    window_start: datetime = K_TEST_WINDOW_START,
    budget_tokens: int = K_TEST_AGGREGATE_BUDGET,
) -> AggregateUsageScope:
    return AggregateUsageScope(
        provider=provider,
        window_start=window_start,
        budget_tokens=budget_tokens,
    )


async def test_week_usage_given_no_row_expect_full_configured_stock(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()

    usage = await AiUsageService(db).load_week_usage(user.id)

    assert usage == AiUsageStatus(
        remaining_tokens=settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
        budget_tokens=settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
    )


async def test_consume_given_successive_calls_expect_stock_decreases(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    service = AiUsageService(db)

    first = await service.consume_tokens(user.id, K_TEST_CONSUME)
    second = await service.consume_tokens(user.id, K_TEST_CONSUME)

    usage = await service.load_week_usage(user.id)
    assert first.admitted is True
    assert second.admitted is True
    assert usage.remaining_tokens == (
        settings.FLYT_AI_WEEKLY_TOKEN_BUDGET - 2 * K_TEST_CONSUME
    )
    assert usage.budget_tokens == settings.FLYT_AI_WEEKLY_TOKEN_BUDGET


async def test_consume_given_amount_exceeds_budget_expect_refused(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", K_TEST_CONSUME - 1)

    admission = await AiUsageService(db).consume_tokens(user.id, K_TEST_CONSUME)

    assert admission.admitted is False
    assert admission.refusal_reason is AiUsageRefusalReason.WEEKLY_BUDGET
    usage = await AiUsageService(db).load_week_usage(user.id)
    assert usage.remaining_tokens == K_TEST_CONSUME - 1


async def test_admit_request_given_request_fits_expect_debited(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()

    admission = await AiUsageService(db).admit_request(user.id, K_TEST_REQUEST)

    usage = await AiUsageService(db).load_week_usage(user.id)
    assert admission.admitted is True
    assert usage.remaining_tokens == (
        settings.FLYT_AI_WEEKLY_TOKEN_BUDGET - K_TEST_REQUEST_ESTIMATE
    )


async def test_admit_request_given_estimate_exceeds_remaining_expect_refused(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await create_usage_row(
        db,
        user.id,
        K_TEST_CONSUME - 1,
        settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
    )

    admission = await AiUsageService(db).admit_request(user.id, K_TEST_REQUEST)

    usage = await AiUsageService(db).load_week_usage(user.id)
    assert admission.admitted is False
    assert admission.refusal_reason is AiUsageRefusalReason.WEEKLY_BUDGET
    assert usage.remaining_tokens == K_TEST_CONSUME - 1


async def test_is_request_admitted_given_request_fits_expect_stock_unchanged(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await create_usage_row(
        db,
        user.id,
        K_TEST_REQUEST_ESTIMATE,
        settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
    )

    admitted = await AiUsageService(db).is_request_admitted(user.id, K_TEST_REQUEST)

    usage = await AiUsageService(db).load_week_usage(user.id)
    assert admitted is True
    assert usage.remaining_tokens == K_TEST_REQUEST_ESTIMATE


async def test_find_remaining_percent_given_no_funded_choice_expect_none(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()

    remaining_percent = await AiUsageService(db).find_remaining_percent(user.id, False)

    assert remaining_percent is None


async def test_find_remaining_percent_given_funded_choice_expect_percent(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await create_usage_row(
        db,
        user.id,
        K_TEST_SNAPSHOT_BUDGET * K_TEST_REMAINING_PERCENT // 100,
        K_TEST_SNAPSHOT_BUDGET,
    )

    remaining_percent = await AiUsageService(db).find_remaining_percent(user.id, True)

    assert remaining_percent == K_TEST_REMAINING_PERCENT


async def test_consume_given_aggregate_expect_both_stocks_decrease(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    service = AiUsageService(db)

    admission = await service.consume_tokens(
        user.id, K_TEST_CONSUME, aggregate=get_aggregate_scope()
    )

    usage = await service.load_week_usage(user.id)
    aggregate = await db.scalar(
        select(FlytAiAggregateUsage).where(
            FlytAiAggregateUsage.provider == "openrouter",
            FlytAiAggregateUsage.window_start == K_TEST_WINDOW_START,
        )
    )
    assert admission.admitted is True
    assert (
        usage.remaining_tokens == settings.FLYT_AI_WEEKLY_TOKEN_BUDGET - K_TEST_CONSUME
    )
    assert aggregate is not None
    assert aggregate.remaining_tokens == K_TEST_AGGREGATE_BUDGET - K_TEST_CONSUME


async def test_consume_given_aggregate_budget_refusal_expect_learner_stock_unchanged(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    scope = get_aggregate_scope(budget_tokens=K_TEST_CONSUME - 1)

    admission = await AiUsageService(db).consume_tokens(
        user.id, K_TEST_CONSUME, aggregate=scope
    )

    assert admission.admitted is False
    assert admission.refusal_reason is AiUsageRefusalReason.AGGREGATE_BUDGET
    usage = await AiUsageService(db).load_week_usage(user.id)
    assert usage.remaining_tokens == settings.FLYT_AI_WEEKLY_TOKEN_BUDGET
    assert (
        await db.scalar(
            select(FlytAiAggregateUsage).where(
                FlytAiAggregateUsage.provider == scope.provider,
                FlytAiAggregateUsage.window_start == scope.window_start,
            )
        )
        is None
    )


async def test_consume_given_aggregate_cancellation_expect_both_stocks_unchanged(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    scope = get_aggregate_scope()

    async def cancel_after_learner_debit(
        self: AiUsageService,
        aggregate: AggregateUsageScope,
        tokens: int,
    ) -> int | None:
        raise asyncio.CancelledError

    monkeypatch.setattr(
        AiUsageService,
        "_consume_aggregate_tokens",
        cancel_after_learner_debit,
    )

    with pytest.raises(asyncio.CancelledError):
        await AiUsageService(db).consume_tokens(
            user.id,
            K_TEST_CONSUME,
            aggregate=scope,
        )
    await db.commit()

    usage = await AiUsageService(db).load_week_usage(user.id)
    aggregate = await db.scalar(
        select(FlytAiAggregateUsage).where(
            FlytAiAggregateUsage.provider == scope.provider,
            FlytAiAggregateUsage.window_start == scope.window_start,
        )
    )
    assert usage.remaining_tokens == usage.budget_tokens
    assert aggregate is None


async def test_consume_given_utc_week_rollover_expect_new_period_stock(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    previous_monday = calculate_utc_week_start() - timedelta(days=7)
    await create_usage_row(
        db,
        user.id,
        0,
        K_TEST_SNAPSHOT_BUDGET,
        previous_monday,
    )
    service = AiUsageService(db)

    admission = await service.consume_tokens(user.id, K_TEST_CONSUME)
    usage = await service.load_week_usage(user.id)

    assert admission.admitted is True
    assert usage.remaining_tokens == (
        settings.FLYT_AI_WEEKLY_TOKEN_BUDGET - K_TEST_CONSUME
    )
    rows = (
        (await db.execute(select(FlytAiUsage).where(FlytAiUsage.user_id == user.id)))
        .scalars()
        .all()
    )
    assert {row.period_start for row in rows} == {
        previous_monday,
        calculate_utc_week_start(),
    }


async def test_consume_given_budget_config_change_expect_snapshot_kept(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    await create_usage_row(db, user.id, K_TEST_SNAPSHOT_BUDGET, K_TEST_SNAPSHOT_BUDGET)
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", 500)

    admission = await AiUsageService(db).consume_tokens(user.id, K_TEST_CONSUME)
    usage = await AiUsageService(db).load_week_usage(user.id)

    assert admission.admitted is True
    assert usage.budget_tokens == K_TEST_SNAPSHOT_BUDGET
    assert usage.remaining_tokens == K_TEST_SNAPSHOT_BUDGET - K_TEST_CONSUME


async def test_consume_given_concurrent_last_tokens_expect_no_learner_overshoot(
    setup_database: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    budget = 1_000
    consume = 400
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", budget)

    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="ai-usage-concurrency@example.com",
            display_name="AI usage concurrency",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    try:

        async def is_admitted() -> bool:
            async with AsyncSessionLocal() as session:
                admission = await AiUsageService(session).consume_tokens(
                    user_id, consume
                )
                await session.commit()
                return admission.admitted

        results = await asyncio.wait_for(
            asyncio.gather(*(is_admitted() for _ in range(K_CONCURRENCY))),
            timeout=8,
        )

        admitted = sum(1 for result in results if result)
        assert admitted == budget // consume

        async with AsyncSessionLocal() as session:
            usage = await AiUsageService(session).load_week_usage(user_id)
        assert usage.remaining_tokens == budget - admitted * consume
        assert usage.remaining_tokens >= 0
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(User).where(User.id == user_id))
            await session.commit()


async def test_consume_given_concurrent_last_aggregate_tokens_expect_no_overshoot(
    setup_database: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    weekly_budget = 10_000
    aggregate_budget = 1_000
    consume = 400
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", weekly_budget)

    async with AsyncSessionLocal() as session:
        users = [
            User(
                uuid=uuid4(),
                email=f"ai-aggregate-{index}@example.com",
                display_name=f"AI aggregate {index}",
                avatar_url=None,
                role=UserRole.USER,
                is_active=True,
            )
            for index in range(K_CONCURRENCY)
        ]
        session.add_all(users)
        await session.commit()
        user_ids = [user.id for user in users]

    scope = get_aggregate_scope(budget_tokens=aggregate_budget)
    try:

        async def is_admitted(user_id: int) -> bool:
            async with AsyncSessionLocal() as session:
                admission = await AiUsageService(session).consume_tokens(
                    user_id, consume, aggregate=scope
                )
                await session.commit()
                return admission.admitted

        results = await asyncio.wait_for(
            asyncio.gather(*(is_admitted(user_id) for user_id in user_ids)),
            timeout=8,
        )

        admitted = sum(1 for result in results if result)
        assert admitted == aggregate_budget // consume

        async with AsyncSessionLocal() as session:
            aggregate = await session.scalar(
                select(FlytAiAggregateUsage).where(
                    FlytAiAggregateUsage.provider == scope.provider,
                    FlytAiAggregateUsage.window_start == scope.window_start,
                )
            )
        assert aggregate is not None
        assert aggregate.remaining_tokens == aggregate_budget - admitted * consume
        assert aggregate.remaining_tokens >= 0
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(User).where(User.id.in_(user_ids)))
            await session.commit()


async def test_consume_given_caller_ends_without_commit_expect_debit_not_durable(
    setup_database: None,
) -> None:
    """The debit is durable only once the caller's composition root commits."""
    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="ai-usage-flush-only@example.com",
            display_name="AI usage flush only",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    try:
        async with AsyncSessionLocal() as caller:
            admission = await AiUsageService(caller).consume_tokens(
                user_id, K_TEST_CONSUME
            )
            assert admission.admitted

        async with AsyncSessionLocal() as verify:
            usage = await AiUsageService(verify).load_week_usage(user_id)
        assert usage.remaining_tokens == settings.FLYT_AI_WEEKLY_TOKEN_BUDGET
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(User).where(User.id == user_id))
            await session.commit()


async def test_consume_given_failure_after_committed_debit_expect_committed_unit_durable(
    setup_database: None,
) -> None:
    """A failure after the composition root's commit leaves the debit and the
    caller's pre-commit writes recorded, and discards only later work."""
    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="ai-usage-durable-debit@example.com",
            display_name="AI usage durable debit",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    try:
        async with AsyncSessionLocal() as caller:
            renamed = await caller.get(User, user_id)
            renamed.display_name = K_TEST_PRE_DEBIT_NAME
            admission = await AiUsageService(caller).consume_tokens(
                user_id, K_TEST_CONSUME
            )
            assert admission.admitted
            await caller.commit()

            renamed.display_name = K_TEST_POST_COMMIT_NAME
            await caller.flush()
            await caller.rollback()

        async with AsyncSessionLocal() as verify:
            usage = await AiUsageService(verify).load_week_usage(user_id)
            verified = await verify.get(User, user_id)
        assert usage.remaining_tokens == (
            settings.FLYT_AI_WEEKLY_TOKEN_BUDGET - K_TEST_CONSUME
        )
        assert verified is not None
        assert verified.display_name == K_TEST_PRE_DEBIT_NAME
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(delete(User).where(User.id == user_id))
            await session.commit()


def test_utc_week_start_given_naive_now_expect_monday() -> None:
    assert calculate_utc_week_start(now()).weekday() == 0


def test_utc_window_start_given_mid_window_expect_epoch_aligned_start() -> None:
    assert calculate_utc_window_start(datetime(2026, 9, 2, 12), 24) == datetime(
        2026, 9, 2
    )
