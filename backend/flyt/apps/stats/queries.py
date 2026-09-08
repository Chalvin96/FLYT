from dataclasses import dataclass
from datetime import datetime
from datetime import time
from datetime import timedelta

from fsrs import Rating
from sqlalchemy import Date
from sqlalchemy import Integer
from sqlalchemy import case
from sqlalchemy import cast
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.queries import query_count_due_states
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.stats.schemas import StatsSnapshotRead
from flyt.libs.utils.date import now


@dataclass(frozen=True)
class DueCountsResult:
    total: int
    new_count: int


class StatsQueryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_due_counts(self, user_id: int) -> DueCountsResult:
        counts = await query_count_due_states(self.db, user_id)
        return DueCountsResult(
            total=counts.new + counts.learning + counts.review,
            new_count=counts.new,
        )

    async def get_lesson_count(self, user_id: int) -> int:
        started_lesson_ids = select(UserLessonProgress.lesson_id).where(
            UserLessonProgress.user_id == user_id
        )
        completed_lesson_ids = select(UserLessonProgress.lesson_id).where(
            UserLessonProgress.user_id == user_id,
            UserLessonProgress.completed_at.is_not(None),
        )
        enrolled_lesson_ids = (
            select(CardPool.lesson_id)
            .join(UserCard, UserCard.pool_id == CardPool.id)
            .where(UserCard.user_id == user_id)
        )
        return (
            await self.db.scalar(
                select(func.count(func.distinct(Lesson.id))).where(
                    Lesson.id.not_in(completed_lesson_ids),
                    or_(
                        Lesson.id.in_(started_lesson_ids),
                        Lesson.id.in_(enrolled_lesson_ids),
                    ),
                )
            )
            or 0
        )

    async def get_card_counts(self, user_id: int) -> dict[CardState, int]:
        rows = (
            await self.db.execute(
                select(UserCard.state, func.count(UserCard.id))
                .where(UserCard.user_id == user_id)
                .where(UserCard.enrollment_state == Enrollment.ACTIVE)
                .group_by(UserCard.state)
            )
        ).all()
        counts = {state: 0 for state in CardState}
        counts.update({state: count for state, count in rows})
        return counts

    async def get_words_practiced_count(self, user_id: int) -> int:
        return (
            await self.db.scalar(
                select(func.count(func.distinct(StatsReviewLog.user_card_id))).where(
                    StatsReviewLog.user_id == user_id
                )
            )
            or 0
        )

    async def get_accuracy_7d(self, user_id: int) -> float | None:
        window_start = now() - timedelta(days=7)
        row = (
            await self.db.execute(
                select(
                    func.count(StatsReviewLog.id).label("total"),
                    func.count(
                        case((StatsReviewLog.rating >= Rating.Good, StatsReviewLog.id))
                    ).label("good"),
                ).where(
                    StatsReviewLog.user_id == user_id,
                    StatsReviewLog.reviewed_at >= window_start,
                )
            )
        ).one()
        if not row.total:
            return None
        return row.good / row.total

    async def get_streak(self, user_id: int) -> int:
        today = now().date()
        yesterday = today - timedelta(days=1)
        reviewed_on = cast(StatsReviewLog.reviewed_at, Date)
        review_days = (
            select(reviewed_on.label("review_day"))
            .where(StatsReviewLog.user_id == user_id)
            .distinct()
            .cte("review_days")
        )
        latest_review_day = (
            select(func.max(review_days.c.review_day).label("latest_review_day"))
            .select_from(review_days)
            .cte("latest_review_day")
        )
        streak_start = (
            select(
                case(
                    (
                        latest_review_day.c.latest_review_day == today,
                        literal(today, type_=Date),
                    ),
                    (
                        latest_review_day.c.latest_review_day == yesterday,
                        literal(yesterday, type_=Date),
                    ),
                    else_=None,
                ).label("streak_start")
            )
            .select_from(latest_review_day)
            .cte("streak_start")
        )
        numbered_review_days = (
            select(
                review_days.c.review_day,
                func.row_number()
                .over(order_by=review_days.c.review_day.desc())
                .label("position"),
            )
            .select_from(review_days)
            .cte("numbered_review_days")
        )
        review_islands = (
            select(
                numbered_review_days.c.review_day,
                (
                    numbered_review_days.c.review_day
                    + cast(numbered_review_days.c.position, Integer)
                ).label("island_key"),
            )
            .select_from(numbered_review_days)
            .cte("review_islands")
        )
        starting_island = (
            select(review_islands.c.island_key)
            .join(
                streak_start,
                review_islands.c.review_day == streak_start.c.streak_start,
            )
            .scalar_subquery()
        )
        streak = await self.db.scalar(
            select(func.count())
            .select_from(review_islands)
            .where(review_islands.c.island_key == starting_island)
        )
        return int(streak or 0)

    async def get_snapshot(self, user_id: int) -> StatsSnapshotRead:
        today = now().date()
        start_of_week = today - timedelta(days=today.weekday())
        window_start = start_of_week - timedelta(weeks=3)
        window_end = start_of_week + timedelta(days=7)
        window_start_at = datetime.combine(window_start, time.min)
        window_end_at = datetime.combine(window_end, time.min)

        reviewed_on = cast(StatsReviewLog.reviewed_at, Date)
        rows = (
            await self.db.execute(
                select(reviewed_on, func.count(StatsReviewLog.id))
                .where(StatsReviewLog.user_id == user_id)
                .where(StatsReviewLog.reviewed_at >= window_start_at)
                .where(StatsReviewLog.reviewed_at < window_end_at)
                .group_by(reviewed_on)
            )
        ).all()

        snapshot = StatsSnapshotRead()
        week_fields = [
            "three_weeks_ago",
            "two_weeks_ago",
            "last_week",
            "this_week",
        ]

        for review_date, review_count in rows:
            delta_days = (review_date - window_start).days
            week_index = delta_days // 7
            day_index = delta_days % 7
            getattr(snapshot, week_fields[week_index])[day_index] = review_count

        return snapshot
