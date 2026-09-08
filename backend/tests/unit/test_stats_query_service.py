from datetime import datetime
from datetime import time
from datetime import timedelta
from datetime import UTC

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.stats.queries import StatsQueryService
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LessonFactory
from tests.factories import StatsReviewLogFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLessonProgressFactory
from tests.factories import UserSettingsFactory

EXPECTED_DUE_TOTAL = 4
EXPECTED_DUE_NEW_COUNT = 2
EXPECTED_INTRODUCED_DUE_COUNT = 4
EXPECTED_ACTIVE_LESSON_COUNT = 2
EXPECTED_STREAK_LENGTH = 2


@pytest.mark.anyio
async def test_get_due_counts_given_no_due_cards_expect_zeros(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    due_counts = await qs.get_due_counts(user_id=user.id)

    assert due_counts.total == 0
    assert due_counts.new_count == 0


@pytest.mark.anyio
async def test_get_due_counts_given_mixed_cards_expect_correct_counts(
    async_session: AsyncSession,
) -> None:
    """Seed UserCards in each eligible state and assert total + new_count.

    Includes a REVIEW card due in 2 days (NOT counted) and an excess of NEW
    cards beyond ``daily_new_limit`` (only the limit is counted).
    """
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    now_n = datetime.now(UTC).replace(tzinfo=None)

    # Eligible: 1 LEARNING (due earlier today), 1 REVIEW (due now), 2 NEW.
    pool_learning = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool_learning, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool_learning,
        state=CardState.LEARNING,
        due_at=now_n - timedelta(minutes=30),
        enrollment_state=Enrollment.ACTIVE,
    )
    pool_review = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool_review, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool_review,
        state=CardState.REVIEW,
        due_at=now_n - timedelta(minutes=60),
        enrollment_state=Enrollment.ACTIVE,
    )
    for _ in range(2):
        pool_new = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool_new, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool_new,
            state=CardState.NEW,
            due_at=now_n,
            enrollment_state=Enrollment.ACTIVE,
        )

    # Extra NEW cards beyond the daily_new_limit of 2 (NOT counted).
    for _ in range(3):
        pool_new_extra = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool_new_extra, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool_new_extra,
            state=CardState.NEW,
            due_at=now_n,
            enrollment_state=Enrollment.ACTIVE,
        )

    # REVIEW card due in 2 days (NOT counted).
    pool_future = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool_future, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool_future,
        state=CardState.REVIEW,
        due_at=now_n + timedelta(days=2),
        enrollment_state=Enrollment.ACTIVE,
    )

    qs = StatsQueryService(async_session)
    due_counts = await qs.get_due_counts(user_id=user.id)

    # learning (1) + review (1) + new_available (2, capped) == 4
    assert due_counts.total == EXPECTED_DUE_TOTAL
    assert due_counts.new_count == EXPECTED_DUE_NEW_COUNT


@pytest.mark.anyio
async def test_get_due_counts_given_introduced_new_cards_over_limit_expect_all_cards(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    now_n = datetime.now(UTC).replace(tzinfo=None)

    for _ in range(4):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            due_at=now_n,
            introduced_at=now_n,
            enrollment_state=Enrollment.ACTIVE,
        )

    due_counts = await StatsQueryService(async_session).get_due_counts(user.id)

    assert due_counts.total == EXPECTED_INTRODUCED_DUE_COUNT
    assert due_counts.new_count == EXPECTED_INTRODUCED_DUE_COUNT


@pytest.mark.anyio
async def test_get_due_counts_given_other_user_data_expect_isolated_counts(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    other_user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    other_pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await FlashCardFactory.create(pool=other_pool, is_addable=True)
    now_n = datetime.now(UTC).replace(tzinfo=None)

    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        due_at=now_n,
        enrollment_state=Enrollment.ACTIVE,
    )
    await UserCardFactory.create(
        user=other_user,
        pool=other_pool,
        state=CardState.NEW,
        due_at=now_n,
        enrollment_state=Enrollment.ACTIVE,
    )

    qs = StatsQueryService(async_session)
    due_counts = await qs.get_due_counts(user_id=user.id)

    assert due_counts.total == 1
    assert due_counts.new_count == 1


@pytest.mark.anyio
async def test_get_lesson_count_given_no_lessons_expect_zero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    count = await qs.get_lesson_count(user_id=user.id)

    assert count == 0


@pytest.mark.anyio
async def test_get_lesson_count_given_started_and_enrolled_expect_non_completed(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lesson_in_progress = await LessonFactory.create(source_id="in-progress")
    lesson_completed = await LessonFactory.create(source_id="completed")
    lesson_available = await LessonFactory.create(source_id="available")
    pool = await CardPoolFactory.create(lesson=lesson_available)
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pool)

    await UserLessonProgressFactory.create(
        user=user, lesson=lesson_in_progress, completed_at=None
    )
    await UserLessonProgressFactory.create(
        user=user, lesson=lesson_completed, completed_at=now()
    )

    qs = StatsQueryService(async_session)
    count = await qs.get_lesson_count(user_id=user.id)

    assert count == EXPECTED_ACTIVE_LESSON_COUNT


@pytest.mark.anyio
async def test_get_card_counts_given_no_cards_expect_zeros(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    counts = await qs.get_card_counts(user_id=user.id)

    assert all(v == 0 for v in counts.values())


@pytest.mark.anyio
async def test_get_card_counts_given_mixed_states_expect_correct_counts(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool_new = await CardPoolFactory.create()
    pool_learning = await CardPoolFactory.create()
    pool_relearning = await CardPoolFactory.create()
    pool_review = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool_new, is_addable=True)
    await FlashCardFactory.create(pool=pool_learning, is_addable=True)
    await FlashCardFactory.create(pool=pool_relearning, is_addable=True)
    await FlashCardFactory.create(pool=pool_review, is_addable=True)

    await UserCardFactory.create(user=user, pool=pool_new, state=CardState.NEW)
    await UserCardFactory.create(
        user=user, pool=pool_learning, state=CardState.LEARNING
    )
    await UserCardFactory.create(
        user=user, pool=pool_relearning, state=CardState.RELEARNING
    )
    await UserCardFactory.create(user=user, pool=pool_review, state=CardState.REVIEW)

    qs = StatsQueryService(async_session)
    counts = await qs.get_card_counts(user_id=user.id)

    assert counts[CardState.NEW] == 1
    assert counts[CardState.LEARNING] == 1
    assert counts[CardState.RELEARNING] == 1
    assert counts[CardState.REVIEW] == 1


@pytest.mark.anyio
async def test_get_words_practiced_count_given_no_reviews_expect_zero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    count = await qs.get_words_practiced_count(user_id=user.id)

    assert count == 0


@pytest.mark.anyio
async def test_get_words_practiced_count_given_multiple_reviews_same_card_expect_distinct(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    await StatsReviewLogFactory.create(user_card=card, rating=3)
    await StatsReviewLogFactory.create(user_card=card, rating=4)

    qs = StatsQueryService(async_session)
    count = await qs.get_words_practiced_count(user_id=user.id)

    assert count == 1


@pytest.mark.anyio
async def test_get_accuracy_7d_given_no_reviews_expect_none(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    accuracy = await qs.get_accuracy_7d(user_id=user.id)

    assert accuracy is None


@pytest.mark.anyio
async def test_get_accuracy_7d_given_mixed_ratings_expect_correct_ratio(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    await StatsReviewLogFactory.create(user_card=card, rating=3)
    await StatsReviewLogFactory.create(user_card=card, rating=1)
    await StatsReviewLogFactory.create(user_card=card, rating=4)

    qs = StatsQueryService(async_session)
    accuracy = await qs.get_accuracy_7d(user_id=user.id)

    assert accuracy == pytest.approx(2 / 3)


@pytest.mark.anyio
async def test_get_accuracy_7d_given_old_review_expect_excluded_from_ratio(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    await StatsReviewLogFactory.create(user_card=card, rating=4)
    await StatsReviewLogFactory.create(user_card=card, rating=1)
    await StatsReviewLogFactory.create(
        user_card=card,
        rating=4,
        reviewed_at=now() - timedelta(days=8),
    )

    qs = StatsQueryService(async_session)
    accuracy = await qs.get_accuracy_7d(user_id=user.id)

    assert accuracy == pytest.approx(1 / 2)


@pytest.mark.anyio
async def test_get_streak_given_no_reviews_expect_zero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    streak = await qs.get_streak(user_id=user.id)

    assert streak == 0


@pytest.mark.anyio
async def test_get_streak_given_consecutive_days_expect_correct_streak(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    today_date = now().date()
    today = datetime.combine(today_date, time(hour=12))
    yesterday = today - timedelta(days=1)

    await StatsReviewLogFactory.create(user_card=card, reviewed_at=today, rating=3)
    await StatsReviewLogFactory.create(user_card=card, reviewed_at=yesterday, rating=3)

    qs = StatsQueryService(async_session)
    streak = await qs.get_streak(user_id=user.id)

    assert streak == EXPECTED_STREAK_LENGTH


@pytest.mark.anyio
async def test_get_streak_given_latest_review_yesterday_expect_streak_continues(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    yesterday = datetime.combine(
        now().date() - timedelta(days=1),
        time(hour=12),
    )
    two_days_ago = yesterday - timedelta(days=1)

    await StatsReviewLogFactory.create(
        user_card=card,
        reviewed_at=yesterday,
        rating=3,
    )
    await StatsReviewLogFactory.create(
        user_card=card,
        reviewed_at=two_days_ago,
        rating=3,
    )

    qs = StatsQueryService(async_session)
    streak = await qs.get_streak(user_id=user.id)

    assert streak == EXPECTED_STREAK_LENGTH


@pytest.mark.anyio
async def test_get_streak_given_gap_expect_streak_breaks_at_gap(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    today_date = now().date()
    today = datetime.combine(today_date, time(hour=12))
    two_days_ago = today - timedelta(days=2)

    await StatsReviewLogFactory.create(user_card=card, reviewed_at=today, rating=3)
    await StatsReviewLogFactory.create(
        user_card=card,
        reviewed_at=two_days_ago,
        rating=3,
    )

    qs = StatsQueryService(async_session)
    streak = await qs.get_streak(user_id=user.id)

    assert streak == 1


@pytest.mark.anyio
async def test_get_streak_given_later_consecutive_days_expect_current_run_only(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    today_date = now().date()
    today = datetime.combine(today_date, time(hour=12))
    two_days_ago = today - timedelta(days=2)
    three_days_ago = today - timedelta(days=3)

    await StatsReviewLogFactory.create(user_card=card, reviewed_at=today, rating=3)
    await StatsReviewLogFactory.create(
        user_card=card,
        reviewed_at=two_days_ago,
        rating=3,
    )
    await StatsReviewLogFactory.create(
        user_card=card,
        reviewed_at=three_days_ago,
        rating=3,
    )

    qs = StatsQueryService(async_session)
    streak = await qs.get_streak(user_id=user.id)

    assert streak == 1


@pytest.mark.anyio
async def test_get_snapshot_given_no_reviews_expect_empty(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    qs = StatsQueryService(async_session)

    snapshot = await qs.get_snapshot(user_id=user.id)

    assert snapshot.model_dump() == {
        "this_week": [0, 0, 0, 0, 0, 0, 0],
        "last_week": [0, 0, 0, 0, 0, 0, 0],
        "two_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
        "three_weeks_ago": [0, 0, 0, 0, 0, 0, 0],
    }


@pytest.mark.anyio
async def test_get_snapshot_given_reviews_expect_correct_counts(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    card = await UserCardFactory.create(user=user, pool=pool)

    today_date = now().date()
    today = datetime.combine(today_date, time(hour=12))
    start_of_week = today_date - timedelta(days=today_date.weekday())
    last_week = datetime.combine(start_of_week - timedelta(days=1), time(hour=12))

    await StatsReviewLogFactory.create(user_card=card, reviewed_at=today, rating=3)
    await StatsReviewLogFactory.create(user_card=card, reviewed_at=last_week, rating=3)

    qs = StatsQueryService(async_session)
    snapshot = await qs.get_snapshot(user_id=user.id)

    assert snapshot.this_week[today_date.weekday()] == 1
    assert snapshot.last_week[6] == 1  # last day of that week
