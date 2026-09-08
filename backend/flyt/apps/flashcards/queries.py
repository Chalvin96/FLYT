from datetime import datetime
from datetime import time

from sqlalchemy import ColumnElement
from sqlalchemy import and_
from sqlalchemy import exists
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.types import QueueStateCounts
from flyt.apps.users.services import UserSettingsService
from flyt.libs.utils.date import now
from flyt.libs.utils.date import start_of_next_utc_day


def addable_variant_exists() -> ColumnElement[bool]:
    return exists().where(
        and_(FlashCard.pool_id == UserCard.pool_id, FlashCard.is_addable.is_(True))
    )


def cards_due_for_review(
    current_time: datetime, day_end: datetime
) -> ColumnElement[bool]:
    """LEARNING/RELEARNING steps due before day end, or REVIEW cards due now,
    on pools that own an addable variant."""
    return and_(
        or_(
            and_(
                UserCard.state.in_([CardState.LEARNING, CardState.RELEARNING]),
                UserCard.due_at < day_end,
            ),
            and_(UserCard.state == CardState.REVIEW, UserCard.due_at <= current_time),
        ),
        addable_variant_exists(),
    )


def active_new_cards(user_id: int) -> ColumnElement[bool]:
    """NEW cards enrolled ACTIVE on pools that own an addable variant."""
    return and_(
        UserCard.user_id == user_id,
        UserCard.enrollment_state.in_([Enrollment.ACTIVE]),
        UserCard.state == CardState.NEW,
        addable_variant_exists(),
    )


def _introducible_new_cards(user_id: int) -> ColumnElement[bool]:
    """NEW cards enrolled ACTIVE or UPCOMING on pools that own an addable
    variant; UPCOMING rows are promotable to fill today's quota."""
    return and_(
        UserCard.user_id == user_id,
        UserCard.enrollment_state.in_([Enrollment.ACTIVE, Enrollment.UPCOMING]),
        UserCard.state == CardState.NEW,
        addable_variant_exists(),
    )


async def query_daily_new_allowance(  # ume-ignore: UME-PY003
    db: AsyncSession, user_id: int, now_dt: datetime
) -> int:
    """New-card introductions still allowed today; never negative."""
    day_start = datetime.combine(now_dt.date(), time.min)
    introduced_today = (
        await db.scalar(
            select(func.count(UserCard.id))
            .where(UserCard.user_id == user_id)
            .where(UserCard.introduced_at.is_not(None))
            .where(UserCard.introduced_at >= day_start)
        )
        or 0
    )
    limit = await UserSettingsService(db).get_new_limit(user_id=user_id)
    return max(0, limit - introduced_today)


async def query_count_due_states(  # ume-ignore: UME-PY003
    db: AsyncSession,
    user_id: int,
    now_dt: datetime | None = None,
) -> QueueStateCounts:
    current_time = now_dt or now()
    day_end = start_of_next_utc_day(current_time)

    learning_review_rows = (
        await db.execute(
            select(UserCard.state, func.count(UserCard.id))
            .where(UserCard.user_id == user_id)
            .where(UserCard.enrollment_state == Enrollment.ACTIVE)
            .where(cards_due_for_review(current_time, day_end))
            .group_by(UserCard.state)
        )
    ).all()
    by_state: dict[CardState, int] = {state: 0 for state in CardState}
    by_state.update({state: count for state, count in learning_review_rows})

    active_introduced_new = (
        await db.scalar(
            select(func.count(UserCard.id))
            .where(active_new_cards(user_id))
            .where(UserCard.introduced_at.is_not(None))
        )
        or 0
    )
    unintroduced_available_new = (
        await db.scalar(
            select(func.count(UserCard.id))
            .where(_introducible_new_cards(user_id))
            .where(UserCard.introduced_at.is_(None))
        )
        or 0
    )
    new_remaining_today = await query_daily_new_allowance(db, user_id, current_time)
    new_count = active_introduced_new + min(
        new_remaining_today, unintroduced_available_new
    )

    return QueueStateCounts(
        new=new_count,
        learning=by_state[CardState.LEARNING] + by_state[CardState.RELEARNING],
        review=by_state[CardState.REVIEW],
    )
