"""Tests for the "add more new" feature (replaces learn-ahead).

Tests:
- add_more_new: promotes UPCOMING up to the endpoint cap, returns count, flips
  enrollment/state/due_at.
- does not use daily_new_limit as the batch cap.
- orders by frequency_rank (lower first).
- excludes pools with no addable variant.
- returns 0 when nothing is UPCOMING.
"""

from datetime import datetime
from datetime import UTC

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.constants import K_ADD_MORE_NEW_CARD_COUNT_MAX
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.services import UserLemmaService
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserSettingsFactory

EXPECTED_FIVE_CARD_PROMOTION = 5
EXPECTED_FOUR_CARD_PROMOTION = 4
EXPECTED_THREE_CARD_PROMOTION = 3


def review_service(session: AsyncSession) -> FlashcardReviewService:
    return FlashcardReviewService(
        session,
        StatsService(session, query_service=StatsQueryService(session)),
        UserLemmaService(session),
        FlashcardCardService(session, UserLemmaService(session)),
    )


async def _make_upcoming(
    session: AsyncSession,
    user,
    *,
    rank: int,
    key: str,
    addable: bool = True,
):
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key=key, frequency_rank=rank)
    if addable:
        await FlashCardFactory.create(pool=pool, is_addable=True)
    return await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.UPCOMING,
        state=CardState.NEW,
    )


@pytest.mark.anyio
async def test_add_more_new_given_more_upcoming_than_daily_limit_expect_all_available_promoted(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=3)
    for rank in range(1, 6):
        await _make_upcoming(async_session, user, rank=rank, key=f"amn-limit-{rank}")

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == EXPECTED_FIVE_CARD_PROMOTION
    active = (
        await async_session.scalars(
            select(UserCard)
            .where(UserCard.user_id == user.id)
            .where(UserCard.enrollment_state == Enrollment.ACTIVE)
        )
    ).all()
    assert len(active) == EXPECTED_FIVE_CARD_PROMOTION
    for uc in active:
        assert uc.state == CardState.NEW
        assert uc.due_at is not None


@pytest.mark.anyio
async def test_issue_due_cards_given_add_more_new_over_daily_limit_expect_promoted_cards_visible(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    for rank in range(1, 5):
        await _make_upcoming(async_session, user, rank=rank, key=f"amn-due-{rank}")
    service = review_service(async_session)

    promoted = await service.add_more_new(user.id)
    due_cards = await service.issue_due_cards(user.id)

    assert promoted == EXPECTED_FOUR_CARD_PROMOTION
    assert len(due_cards) == EXPECTED_FOUR_CARD_PROMOTION


@pytest.mark.anyio
async def test_count_due_states_given_add_more_new_over_daily_limit_expect_promoted_cards_counted(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    for rank in range(1, 5):
        await _make_upcoming(async_session, user, rank=rank, key=f"amn-count-{rank}")
    service = review_service(async_session)

    promoted = await service.add_more_new(user.id)
    counts = await service.count_due_states(user.id)

    assert promoted == EXPECTED_FOUR_CARD_PROMOTION
    assert counts.new == EXPECTED_FOUR_CARD_PROMOTION


@pytest.mark.anyio
async def test_add_more_new_given_ranked_upcoming_cards_expect_all_promoted(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    ucs = {}
    for rank in [5, 1, 3, 2, 4]:
        ucs[rank] = await _make_upcoming(
            async_session, user, rank=rank, key=f"amn-order-{rank}"
        )

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == EXPECTED_FIVE_CARD_PROMOTION
    active = (
        await async_session.scalars(
            select(UserCard)
            .where(UserCard.user_id == user.id)
            .where(UserCard.enrollment_state == Enrollment.ACTIVE)
            .order_by(UserCard.id.asc())
        )
    ).all()
    active_ids = {uc.id for uc in active}
    assert active_ids == {uc.id for uc in ucs.values()}


@pytest.mark.anyio
async def test_add_more_new_given_more_than_endpoint_max_expect_endpoint_cap_applied(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(
        user=user, daily_new_limit=K_ADD_MORE_NEW_CARD_COUNT_MAX + 20
    )
    for rank in range(1, K_ADD_MORE_NEW_CARD_COUNT_MAX + 6):
        await _make_upcoming(async_session, user, rank=rank, key=f"amn-max-{rank}")

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == K_ADD_MORE_NEW_CARD_COUNT_MAX


@pytest.mark.anyio
async def test_add_more_new_given_non_addable_pool_expect_skipped(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=5)
    await _make_upcoming(
        async_session, user, rank=1, key="amn-noaddable", addable=False
    )

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == 0


@pytest.mark.anyio
async def test_add_more_new_given_no_upcoming_cards_expect_zero(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=5)

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == 0


@pytest.mark.anyio
async def test_add_more_new_given_upcoming_card_expect_active_due_now(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=5)
    uc = await _make_upcoming(async_session, user, rank=1, key="amn-flip")
    before = datetime.now(UTC)

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == 1
    result = await async_session.scalar(select(UserCard).where(UserCard.id == uc.id))
    assert result is not None
    assert result.enrollment_state == Enrollment.ACTIVE
    assert result.state == CardState.NEW
    assert result.due_at is not None
    after = datetime.now(UTC)
    # due_at should be set to ~now (within a generous window).
    naive_before = before.replace(tzinfo=None)
    naive_after = after.replace(tzinfo=None)
    assert naive_before <= result.due_at <= naive_after


@pytest.mark.anyio
async def test_add_more_new_given_less_than_endpoint_max_expect_available_count(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=10)
    for rank in range(1, 4):
        await _make_upcoming(async_session, user, rank=rank, key=f"amn-clamp-{rank}")

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == EXPECTED_THREE_CARD_PROMOTION
