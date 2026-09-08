"""Atomic token debits for Flyt-funded AI requests."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.constants import K_AI_USAGE_ESTIMATION_OVERHEAD_TOKENS
from flyt.apps.ai_usage.models import FlytAiAggregateUsage
from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.types import AggregateUsageScope
from flyt.apps.ai_usage.types import AiUsageAdmission
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.ai_usage.types import AiUsageRefusalReason
from flyt.apps.ai_usage.types import AiUsageStatus
from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.core.config import settings


def is_weekly_admissible(status: AiUsageStatus, request: AiUsageRequest) -> bool:
    """Whether the estimated request fits the learner's weekly stock."""
    tokens = _estimate_request_tokens(request)
    if tokens > settings.FLYT_AI_WEEKLY_TOKEN_BUDGET:
        return False
    return status.remaining_tokens >= tokens


def _estimate_request_tokens(request: AiUsageRequest) -> int:
    if request.max_tokens is not None and request.max_tokens < 0:
        raise ValueError("max_tokens must not be negative")
    encoded_bytes = len(request.instructions.encode("utf-8")) + len(
        request.prompt.encode("utf-8")
    )
    return (
        encoded_bytes
        + K_AI_USAGE_ESTIMATION_OVERHEAD_TOKENS
        + (request.max_tokens or 0)
    )


class AiUsageService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def load_week_usage(self, user_id: int) -> AiUsageStatus:
        usage = await self._db.scalar(
            select(FlytAiUsage).where(
                FlytAiUsage.user_id == user_id,
                FlytAiUsage.period_start == calculate_utc_week_start(),
            )
        )
        if usage is None:
            return AiUsageStatus(
                remaining_tokens=settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
                budget_tokens=settings.FLYT_AI_WEEKLY_TOKEN_BUDGET,
            )
        return AiUsageStatus(
            remaining_tokens=usage.remaining_tokens,
            budget_tokens=usage.budget_tokens,
        )

    async def admit_request(
        self,
        user_id: int,
        request: AiUsageRequest,
        aggregate: AggregateUsageScope | None = None,
    ) -> AiUsageAdmission:
        return await self.consume_tokens(
            user_id,
            _estimate_request_tokens(request),
            aggregate=aggregate,
        )

    async def is_request_admitted(self, user_id: int, request: AiUsageRequest) -> bool:
        return is_weekly_admissible(await self.load_week_usage(user_id), request)

    async def find_remaining_percent(
        self, user_id: int, has_funded_choice: bool
    ) -> int | None:
        if not has_funded_choice:
            return None
        return (await self.load_week_usage(user_id)).remaining_percent

    async def consume_tokens(
        self,
        user_id: int,
        tokens: int,
        aggregate: AggregateUsageScope | None = None,
    ) -> AiUsageAdmission:
        """Debit learner (and optional aggregate) stock atomically; flushes only.

        The commit belongs to the caller's composition root.
        """
        _validate_token_amount(tokens)
        weekly_budget = settings.FLYT_AI_WEEKLY_TOKEN_BUDGET
        if tokens > weekly_budget:
            return AiUsageAdmission(False, AiUsageRefusalReason.WEEKLY_BUDGET)
        if aggregate is not None:
            _validate_aggregate_scope(aggregate)
            if tokens > aggregate.budget_tokens:
                return AiUsageAdmission(False, AiUsageRefusalReason.AGGREGATE_BUDGET)

        period_start = calculate_utc_week_start()
        await self._db.flush()
        savepoint = await self._db.begin_nested()
        try:
            learner_usage_id = await self._consume_learner_tokens(
                user_id, period_start, tokens, weekly_budget
            )
            if learner_usage_id is None:
                await savepoint.rollback()
                return AiUsageAdmission(False, AiUsageRefusalReason.WEEKLY_BUDGET)

            if aggregate is not None:
                aggregate_usage_id = await self._consume_aggregate_tokens(
                    aggregate, tokens
                )
                if aggregate_usage_id is None:
                    await savepoint.rollback()
                    return AiUsageAdmission(
                        False, AiUsageRefusalReason.AGGREGATE_BUDGET
                    )

            await savepoint.commit()
        except BaseException:
            if savepoint.is_active:
                await savepoint.rollback()
            raise

        return AiUsageAdmission(True, None)

    async def _consume_learner_tokens(
        self,
        user_id: int,
        period_start: date,
        tokens: int,
        budget_tokens: int,
    ) -> int | None:
        insert_statement = insert(FlytAiUsage).values(
            user_id=user_id,
            period_start=period_start,
            remaining_tokens=budget_tokens - tokens,
            budget_tokens=budget_tokens,
        )
        result = await self._db.execute(
            insert_statement.on_conflict_do_update(
                index_elements=[FlytAiUsage.user_id, FlytAiUsage.period_start],
                set_={"remaining_tokens": FlytAiUsage.remaining_tokens - tokens},
                where=FlytAiUsage.remaining_tokens >= tokens,
            ).returning(FlytAiUsage.id)
        )
        return result.scalar_one_or_none()

    async def _consume_aggregate_tokens(
        self,
        aggregate: AggregateUsageScope,
        tokens: int,
    ) -> int | None:
        insert_statement = insert(FlytAiAggregateUsage).values(
            provider=aggregate.provider,
            window_start=aggregate.window_start,
            remaining_tokens=aggregate.budget_tokens - tokens,
            budget_tokens=aggregate.budget_tokens,
        )
        result = await self._db.execute(
            insert_statement.on_conflict_do_update(
                index_elements=[
                    FlytAiAggregateUsage.provider,
                    FlytAiAggregateUsage.window_start,
                ],
                set_={
                    "remaining_tokens": FlytAiAggregateUsage.remaining_tokens - tokens
                },
                where=FlytAiAggregateUsage.remaining_tokens >= tokens,
            ).returning(FlytAiAggregateUsage.id)
        )
        return result.scalar_one_or_none()


def _validate_token_amount(tokens: int) -> None:
    if tokens < 1:
        raise ValueError("tokens must be positive")


def _validate_aggregate_scope(aggregate: AggregateUsageScope) -> None:
    if not aggregate.provider.strip():
        raise ValueError("aggregate.provider must not be empty")
    if aggregate.budget_tokens < 1:
        raise ValueError("aggregate.budget_tokens must be positive")
    if aggregate.window_start.tzinfo is not None:
        raise ValueError("aggregate.window_start must be a naive UTC datetime")
