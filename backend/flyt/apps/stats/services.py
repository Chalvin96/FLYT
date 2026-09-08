from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.schemas import StatsRead
from flyt.libs.utils.date import to_utc_naive


class StatsService:
    """Command-side stats service. Read queries are delegated to StatsQueryService."""

    def __init__(self, db: AsyncSession, query_service: StatsQueryService):
        self.db = db
        self.query_service = query_service

    def create_review_log(
        self,
        user_id: int,
        user_card_id: int,
        rating: int,
        reviewed_at: datetime | None,
    ) -> None:
        self.db.add(
            StatsReviewLog(
                user_id=user_id,
                user_card_id=user_card_id,
                rating=rating,
                reviewed_at=to_utc_naive(reviewed_at),
            )
        )

    async def get_stats(self, user_id: int) -> StatsRead:
        due_counts = await self.query_service.get_due_counts(user_id=user_id)
        lesson_count = await self.query_service.get_lesson_count(user_id=user_id)
        card_counts = await self.query_service.get_card_counts(user_id=user_id)
        accuracy_7d = await self.query_service.get_accuracy_7d(user_id=user_id)
        words_practiced = await self.query_service.get_words_practiced_count(
            user_id=user_id
        )
        streak = await self.query_service.get_streak(user_id=user_id)
        snapshot = await self.query_service.get_snapshot(user_id=user_id)

        return StatsRead(
            dueCount=due_counts.total,
            dueNew=due_counts.new_count,
            lessonCount=lesson_count,
            new=card_counts[CardState.NEW],
            learning=card_counts[CardState.LEARNING],
            relearning=card_counts[CardState.RELEARNING],
            accuracy7d=accuracy_7d,
            wordsPracticed=words_practiced,
            streak=streak,
            snapshot=snapshot,
        )


def make_stats_service(db: AsyncSession) -> StatsService:
    return StatsService(db, query_service=StatsQueryService(db))
