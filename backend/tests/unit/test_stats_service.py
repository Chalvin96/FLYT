from dataclasses import dataclass
from datetime import date
from datetime import datetime
from datetime import time
from datetime import timedelta

import pytest
from fsrs import Rating
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lessons.models import Lesson
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.models import User
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LessonFactory
from tests.factories import StatsReviewLogFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLessonProgressFactory

EXPECTED_STATS_DUE_COUNT = 2
EXPECTED_STATS_LESSON_COUNT = 2
EXPECTED_STATS_WORDS_PRACTICED = 3


@pytest.mark.anyio
async def test_get_stats_given_empty_user_expect_zero_state(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    stats = await StatsService(
        async_session, query_service=StatsQueryService(async_session)
    ).get_stats(user_id=user.id)

    assert stats.model_dump() == {
        "dueCount": 0,
        "dueNew": 0,
        "lessonCount": 0,
        "new": 0,
        "learning": 0,
        "relearning": 0,
        "accuracy7d": None,
        "wordsPracticed": 0,
        "streak": 0,
        "snapshot": {
            "this_week": [0, 0, 0, 0, 0, 0, 0],
            "last_week": [0, 0, 0, 0, 0, 0, 0],
            "two_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
            "three_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
        },
    }


@pytest.mark.anyio
async def test_get_stats_given_cards_logs_and_lessons_expect_frontend_contract(
    async_session: AsyncSession,
) -> None:
    fixture = await _create_stats_fixture()

    service = StatsService(
        async_session, query_service=StatsQueryService(async_session)
    )

    stats = await service.get_stats(user_id=fixture.user_id)
    expected_accuracy = _expected_accuracy(fixture.events)

    assert stats.dueCount == EXPECTED_STATS_DUE_COUNT
    assert stats.dueNew == 1
    assert stats.lessonCount == EXPECTED_STATS_LESSON_COUNT
    assert stats.new == 1
    assert stats.learning == 1
    assert stats.relearning == 1
    assert stats.accuracy7d == pytest.approx(expected_accuracy)
    assert stats.wordsPracticed == EXPECTED_STATS_WORDS_PRACTICED
    assert stats.streak == _expected_streak(fixture.events, fixture.today_date)
    assert stats.snapshot.model_dump() == _expected_snapshot(
        fixture.events, fixture.today_date
    )


ReviewEvent = tuple[UserCard, datetime, int]


@dataclass(frozen=True)
class StatsFixture:
    user_id: int
    events: list[ReviewEvent]
    today_date: date


async def _create_stats_fixture() -> StatsFixture:
    user = await UserFactory.create()
    lessons = await _create_stats_lessons()
    pools = await _create_stats_pools(lessons)
    cards = await _create_stats_cards(user, pools)
    events = await _create_stats_review_events(cards)
    return StatsFixture(user.id, events, now().date())


async def _create_stats_lessons() -> tuple[Lesson, Lesson, Lesson]:
    return (
        await LessonFactory.create(source_id="available"),
        await LessonFactory.create(source_id="in-progress"),
        await LessonFactory.create(source_id="completed"),
    )


async def _create_stats_pools(
    lessons: tuple[Lesson, Lesson, Lesson],
) -> tuple[CardPool, CardPool, CardPool, CardPool]:
    lesson_available, lesson_in_progress, lesson_completed = lessons
    await LessonFactory.create(source_id="other")
    return (
        await CardPoolFactory.create(lesson=lesson_available, key="available-new"),
        await CardPoolFactory.create(lesson=lesson_available, key="available-learning"),
        await CardPoolFactory.create(
            lesson=lesson_in_progress, key="in-progress-relearning"
        ),
        await CardPoolFactory.create(lesson=lesson_completed, key="completed-review"),
    )


async def _create_stats_cards(
    user: User, pools: tuple[CardPool, CardPool, CardPool, CardPool]
) -> tuple[UserCard, UserCard, UserCard, UserCard]:
    available_new_pool, available_learning_pool, in_progress_pool, completed_pool = (
        pools
    )
    await FlashCardFactory.create(pool=available_new_pool, is_addable=True)
    await FlashCardFactory.create(pool=available_learning_pool, is_addable=True)
    await FlashCardFactory.create(pool=in_progress_pool, is_addable=True)
    await FlashCardFactory.create(pool=completed_pool, is_addable=True)
    cards = (
        await UserCardFactory.create(
            user=user, pool=available_new_pool, state=CardState.NEW
        ),
        await UserCardFactory.create(
            user=user,
            pool=available_learning_pool,
            state=CardState.LEARNING,
            due_at=now() + timedelta(days=2),
        ),
        await UserCardFactory.create(
            user=user,
            pool=in_progress_pool,
            state=CardState.RELEARNING,
            due_at=now() + timedelta(days=2),
        ),
        await UserCardFactory.create(
            user=user, pool=completed_pool, state=CardState.REVIEW
        ),
    )
    await UserLessonProgressFactory.create(
        user=user, lesson=pools[2].lesson, completed_at=None
    )
    await UserLessonProgressFactory.create(
        user=user, lesson=pools[3].lesson, completed_at=now()
    )
    return cards


async def _create_stats_review_events(
    cards: tuple[UserCard, UserCard, UserCard, UserCard],
) -> list[ReviewEvent]:
    _, learning_card, relearning_card, review_card = cards
    today = datetime.combine(now().date(), time(hour=12))
    yesterday = today - timedelta(days=1)
    start_of_week = today.date() - timedelta(days=today.weekday())
    last_week = datetime.combine(start_of_week - timedelta(days=1), time(hour=12))
    events = [
        (learning_card, today, 3),
        (learning_card, today - timedelta(minutes=5), 2),
        (relearning_card, yesterday, 4),
        (review_card, last_week, 3),
        (review_card, last_week - timedelta(days=7), 3),
        (review_card, last_week - timedelta(days=14), 3),
    ]
    for user_card, reviewed_at, rating in events:
        await StatsReviewLogFactory.create(
            user_card=user_card, reviewed_at=reviewed_at, rating=rating
        )
    return events


def _expected_snapshot(
    events: list[ReviewEvent], today_date: date
) -> dict[str, list[int]]:
    fields = ["three_weeks_ago", "two_weeks_ago", "last_week", "this_week"]
    snapshot = {field: [0] * 7 for field in fields}
    window_start = today_date - timedelta(days=today_date.weekday(), weeks=3)
    for _, reviewed_at, _ in events:
        delta_days = (reviewed_at.date() - window_start).days
        snapshot[fields[delta_days // 7]][delta_days % 7] += 1
    return snapshot


def _expected_accuracy(events: list[ReviewEvent]) -> float:
    cutoff = now() - timedelta(days=7)
    ratings = [rating for _, reviewed_at, rating in events if reviewed_at >= cutoff]
    return sum(rating >= Rating.Good for rating in ratings) / len(ratings)


def _expected_streak(events: list[ReviewEvent], today_date: date) -> int:
    reviewed_dates = sorted(
        {reviewed_at.date() for _, reviewed_at, _ in events}, reverse=True
    )
    if not reviewed_dates or reviewed_dates[0] not in {
        today_date,
        today_date - timedelta(days=1),
    }:
        return 0
    expected_day = reviewed_dates[0]
    streak = 0
    for review_day in reviewed_dates:
        if review_day != expected_day:
            break
        streak += 1
        expected_day -= timedelta(days=1)
    return streak
