"""Tests for the frequency-deck feature (BACKEND).

Covers:
- subscribe creates UPCOMING
- subscribe skips pools addable only in another deck
- issue_due_cards new top-up: NEW cards ordered by frequency_rank, capped by
  daily_new_limit
- promote_upcoming_to_fill / add_more_new promote UPCOMING by frequency_rank
- enrollment filters exclude UPCOMING from counts/my-cards
- reading derivation states
- add-to-review promotes UPCOMING + backfills UserLemma
- GET /decks shape
"""

from datetime import datetime
from datetime import UTC

import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.deck_service import FlashcardDeckService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.flashcards.user_cards_service import MyCardsService
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_LEARNING
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_MASTERED
from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_NEW
from flyt.apps.reading.services import ReadingService
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.models import UserLemma
from flyt.apps.users.services import UserLemmaService
from tests.factories import CardPoolFactory
from tests.factories import DeckFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserSettingsFactory

EXPECTED_SUBSCRIBED_CARD_COUNT = 2
EXPECTED_DUE_NEW_CARD_COUNT = 2
EXPECTED_THREE_CARD_COUNT = 3
EXPECTED_PROMOTED_CARD_COUNT = 2
EXPECTED_ADD_MORE_PROMOTED_COUNT = 5
EXPECTED_ACTIVE_CARD_COUNT = 5
EXPECTED_DECK_CARD_COUNT = 2


def card_service(session: AsyncSession) -> FlashcardCardService:
    return FlashcardCardService(session, UserLemmaService(session))


def review_service(session: AsyncSession) -> FlashcardReviewService:
    return FlashcardReviewService(
        session,
        StatsService(session, query_service=StatsQueryService(session)),
        UserLemmaService(session),
        card_service(session),
    )


def deck_service(session: AsyncSession) -> FlashcardDeckService:
    return FlashcardDeckService(session)


def my_cards_service(session: AsyncSession) -> MyCardsService:
    return MyCardsService(session)


@pytest.mark.anyio
async def test_subscribe_to_deck_creates_upcoming_cards(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool_a = await CardPoolFactory.create(key="freq-pool-a")
    pool_b = await CardPoolFactory.create(key="freq-pool-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)

    await deck_service(async_session).subscribe_to_deck(
        user_id=user.id, deck_id=deck.id
    )

    cards = (
        await async_session.scalars(select(UserCard).where(UserCard.user_id == user.id))
    ).all()
    assert len(cards) == EXPECTED_SUBSCRIBED_CARD_COUNT
    assert all(c.enrollment_state == Enrollment.UPCOMING for c in cards)
    assert all(c.state == CardState.NEW for c in cards)


@pytest.mark.anyio
async def test_subscribe_to_deck_is_idempotent_and_tops_up(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool_a = await CardPoolFactory.create(key="topup-a")
    pool_b = await CardPoolFactory.create(key="topup-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)

    svc = deck_service(async_session)

    # First subscribe creates one UPCOMING.
    await svc.subscribe_to_deck(user_id=user.id, deck_id=deck.id)
    count_1 = await async_session.scalar(
        select(func.count(UserCard.id)).where(UserCard.user_id == user.id)
    )
    assert count_1 == 1

    # Add another pool to the deck.
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)

    # Re-subscribe tops up the missing pool.
    await svc.subscribe_to_deck(user_id=user.id, deck_id=deck.id)
    count_2 = await async_session.scalar(
        select(func.count(UserCard.id)).where(UserCard.user_id == user.id)
    )
    assert count_2 == EXPECTED_SUBSCRIBED_CARD_COUNT


@pytest.mark.anyio
async def test_subscribe_to_deck_given_pool_addable_only_in_other_deck_expect_not_enrolled(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    other_deck = await DeckFactory.create()
    pool = await CardPoolFactory.create(key="cross-deck-pool")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=False)
    await FlashCardFactory.create(deck=other_deck, pool=pool, is_addable=True)

    await deck_service(async_session).subscribe_to_deck(
        user_id=user.id, deck_id=deck.id
    )

    enrolled = await async_session.scalar(
        select(func.count(UserCard.id))
        .where(UserCard.user_id == user.id)
        .where(UserCard.pool_id == pool.id)
    )
    assert enrolled == 0


@pytest.mark.anyio
async def test_upcoming_excluded_from_card_counts(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool_active = await CardPoolFactory.create(key="cnt-active")
    pool_upcoming = await CardPoolFactory.create(key="cnt-upcoming")
    await FlashCardFactory.create(pool=pool_active, is_addable=True)
    await FlashCardFactory.create(pool=pool_upcoming, is_addable=True)

    await UserCardFactory.create(
        user=user,
        pool=pool_active,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
    )
    await UserCardFactory.create(
        user=user,
        pool=pool_upcoming,
        state=CardState.NEW,
        enrollment_state=Enrollment.UPCOMING,
    )

    qs = StatsQueryService(async_session)
    counts = await qs.get_card_counts(user_id=user.id)

    assert counts[CardState.NEW] == 1


@pytest.mark.anyio
async def test_upcoming_excluded_from_my_cards(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma_a = await LemmaFactory.create(word="active-word")
    lemma_b = await LemmaFactory.create(word="upcoming-word")
    pool_a = await CardPoolFactory.create(lemma=lemma_a, key="my-active")
    pool_b = await CardPoolFactory.create(lemma=lemma_b, key="my-upcoming")
    await UserCardFactory.create(
        user=user, pool=pool_a, enrollment_state=Enrollment.ACTIVE
    )
    await UserCardFactory.create(
        user=user, pool=pool_b, enrollment_state=Enrollment.UPCOMING
    )

    result = await my_cards_service(async_session).list_user_cards(
        user.id, started_only=False, limit=50
    )

    assert result.total == 1


# --- issue_due_cards new top-up (frequency_rank ordering + daily_new_limit cap) ---


@pytest.mark.anyio
async def test_issue_due_cards_given_ranked_new_pools_expect_topup_ordered_by_frequency_rank(
    async_session: AsyncSession,
) -> None:
    """ACTIVE NEW cards surface in issue_due_cards ordered by frequency_rank."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=10)

    pools_by_rank: dict[int, CardPool] = {}
    for rank in (30, 10, 20):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.ACTIVE,
            due_at=datetime.now(UTC).replace(tzinfo=None),
        )
        pools_by_rank[rank] = pool

    due = await review_service(async_session).issue_due_cards(user_id=user.id)

    assert [dc.user_card.pool_id for dc in due] == [
        pools_by_rank[10].id,
        pools_by_rank[20].id,
        pools_by_rank[30].id,
    ]


@pytest.mark.anyio
async def test_issue_due_cards_given_ranked_new_pools_over_daily_limit_expect_topup_capped(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)

    for rank in range(1, 6):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.ACTIVE,
            due_at=datetime.now(UTC).replace(tzinfo=None),
        )

    due = await review_service(async_session).issue_due_cards(user_id=user.id)
    new_cards = [dc for dc in due if dc.user_card.state == CardState.NEW]
    assert len(new_cards) == EXPECTED_DUE_NEW_CARD_COUNT


@pytest.mark.anyio
async def test_issue_due_cards_given_insufficient_active_new_expect_upcoming_promoted_to_fill(
    async_session: AsyncSession,
) -> None:
    """When ACTIVE NEW cards < daily_new_limit, UPCOMING are promoted to fill."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=3)

    # One ACTIVE NEW card (rank 1).
    active_pool = await CardPoolFactory.create(frequency_rank=1)
    await FlashCardFactory.create(pool=active_pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=active_pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )

    # Two UPCOMING cards (ranks 2, 3) — should be promoted to fill the limit.
    upcoming_pools: list[CardPool] = []
    for rank in (2, 3):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
            due_at=datetime.now(UTC).replace(tzinfo=None),
        )
        upcoming_pools.append(pool)

    due = await review_service(async_session).issue_due_cards(user_id=user.id)
    new_cards = [dc for dc in due if dc.user_card.state == CardState.NEW]
    assert len(new_cards) == EXPECTED_THREE_CARD_COUNT


@pytest.mark.anyio
async def test_issue_due_cards_given_null_frequency_rank_expect_reading_card_after_ranked(
    async_session: AsyncSession,
) -> None:
    """Reading-discovered cards (null frequency_rank) come AFTER ranked ones."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=10)

    # Frequency-deck card with rank 1.
    freq_pool = await CardPoolFactory.create(frequency_rank=1)
    await FlashCardFactory.create(pool=freq_pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=freq_pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )

    # Reading-discovered card (null frequency_rank).
    reading_pool = await CardPoolFactory.create(frequency_rank=None)
    await FlashCardFactory.create(pool=reading_pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=reading_pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.ACTIVE,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )

    due = await review_service(async_session).issue_due_cards(user_id=user.id)

    assert [dc.user_card.pool_id for dc in due] == [freq_pool.id, reading_pool.id]


# --- promote_upcoming_to_fill / add_more_new ---


@pytest.mark.anyio
async def test_promote_upcoming_to_fill_promotes_by_frequency_rank(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pools_by_rank: dict[int, CardPool] = {}
    for rank in (5, 1, 3, 2, 4):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
        )
        pools_by_rank[rank] = pool

    promoted = await review_service(async_session).promote_upcoming_to_fill(
        user_id=user.id, want=2, exclude_pool_ids=set()
    )

    assert len(promoted) == EXPECTED_PROMOTED_CARD_COUNT
    assert [uc.pool_id for uc in promoted] == [
        pools_by_rank[1].id,
        pools_by_rank[2].id,
    ]
    for uc in promoted:
        assert uc.enrollment_state == Enrollment.ACTIVE
        assert uc.state == CardState.NEW


@pytest.mark.anyio
async def test_promote_upcoming_to_fill_respects_exclude_pool_ids(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pools_by_rank: dict[int, CardPool] = {}
    for rank in (1, 2, 3):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
        )
        pools_by_rank[rank] = pool

    promoted = await review_service(async_session).promote_upcoming_to_fill(
        user_id=user.id,
        want=3,
        exclude_pool_ids={pools_by_rank[1].id},
    )

    assert len(promoted) == EXPECTED_PROMOTED_CARD_COUNT
    assert {uc.pool_id for uc in promoted} == {
        pools_by_rank[2].id,
        pools_by_rank[3].id,
    }


@pytest.mark.anyio
async def test_add_more_new_given_daily_limit_lower_than_upcoming_expect_all_promoted(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=3)
    for rank in range(1, 6):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
        )

    promoted = await review_service(async_session).add_more_new(user.id)

    assert promoted == EXPECTED_ADD_MORE_PROMOTED_COUNT
    active_count = await async_session.scalar(
        select(func.count(UserCard.id)).where(
            UserCard.user_id == user.id,
            UserCard.enrollment_state == Enrollment.ACTIVE,
        )
    )
    assert active_count == EXPECTED_ACTIVE_CARD_COUNT


# --- Reading derivation states ---


@pytest.mark.anyio
async def test_reading_derivation_upcoming_renders_as_new(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="reading-upcoming")
    await UserCardFactory.create(
        user=user, pool=pool, enrollment_state=Enrollment.UPCOMING
    )

    service = ReadingService(async_session)
    states = await service._get_user_states_for_tokens(
        [{"lemmaUuid": str(lemma.uuid)}], user.id
    )

    assert states[str(lemma.uuid)] == K_USER_LEMMA_STATE_NEW


@pytest.mark.anyio
async def test_reading_derivation_active_card_without_user_lemma_renders_as_new(
    async_session: AsyncSession,
) -> None:
    """Vocabulary state reads from UserLemma only. An ACTIVE card without a
    UserLemma row (pre-backfill state) reads as "new". The activation invariant
    ensures this combination does not occur for cards activated through the
    shared activation command."""
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="reading-active")
    await UserCardFactory.create(
        user=user, pool=pool, enrollment_state=Enrollment.ACTIVE
    )

    service = ReadingService(async_session)
    states = await service._get_user_states_for_tokens(
        [{"lemmaUuid": str(lemma.uuid)}], user.id
    )

    assert states[str(lemma.uuid)] == K_USER_LEMMA_STATE_NEW


@pytest.mark.anyio
async def test_get_user_states_for_tokens_given_saved_lemma_and_active_card_expect_active_card_wins(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    active_pool = await CardPoolFactory.create(lemma=lemma, key="reading-active-win")
    async_session.add(UserLemma(user_id=user.id, lemma_id=lemma.id, is_mastered=False))
    await async_session.flush()
    await UserCardFactory.create(
        user=user,
        pool=active_pool,
        enrollment_state=Enrollment.ACTIVE,
        state=CardState.NEW,
    )

    service = ReadingService(async_session)
    states = await service._get_user_states_for_tokens(
        [{"lemmaUuid": str(lemma.uuid)}], user.id
    )

    assert states[str(lemma.uuid)] == K_USER_LEMMA_STATE_LEARNING


@pytest.mark.anyio
async def test_reading_derivation_user_lemma_mastered(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="reading-mastered")
    await UserCardFactory.create(
        user=user, pool=pool, enrollment_state=Enrollment.ACTIVE
    )
    from flyt.apps.users.models import UserLemma

    async_session.add(UserLemma(user_id=user.id, lemma_id=lemma.id, is_mastered=True))
    await async_session.flush()

    service = ReadingService(async_session)
    states = await service._get_user_states_for_tokens(
        [{"lemmaUuid": str(lemma.uuid)}], user.id
    )

    assert states[str(lemma.uuid)] == K_USER_LEMMA_STATE_MASTERED


@pytest.mark.anyio
async def test_add_lemma_to_deck_promotes_upcoming_and_backfills_user_lemma(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="add-promote")
    await FlashCardFactory.create(pool=pool, is_addable=True)
    # Existing UPCOMING card (as if from a deck subscribe).
    existing = await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.UPCOMING,
    )

    await card_service(async_session).add_lemma_to_deck(user.id, lemma.uuid)

    # The card should be promoted, not duplicated.
    cards = (
        await async_session.scalars(
            select(UserCard).where(
                UserCard.user_id == user.id,
                UserCard.pool_id == pool.id,
            )
        )
    ).all()
    assert len(cards) == 1
    assert cards[0].id == existing.id
    assert cards[0].enrollment_state == Enrollment.ACTIVE

    # UserLemma should be backfilled.
    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is False


# --- Deck browse ---


@pytest.mark.anyio
async def test_list_decks_returns_correct_shape(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Most Frequent", cefr_range="A1-B2")
    pool_a = await CardPoolFactory.create(key="ld-a", frequency_rank=1)
    pool_b = await CardPoolFactory.create(key="ld-b", frequency_rank=2)
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)
    # User has one ACTIVE card (studied) and one UPCOMING.
    await UserCardFactory.create(
        user=user,
        pool=pool_a,
        enrollment_state=Enrollment.ACTIVE,
        state=CardState.REVIEW,
    )
    await UserCardFactory.create(
        user=user,
        pool=pool_b,
        enrollment_state=Enrollment.UPCOMING,
    )

    result = await deck_service(async_session).list_decks(user_id=user.id)

    assert len(result) == 1
    d = result[0]
    assert d.id == deck.id
    assert d.name == "Most Frequent"
    assert d.card_count == EXPECTED_DECK_CARD_COUNT
    assert d.cefr_range == "A1-B2"
    assert d.is_subscribed is True
    assert d.studied_count == 1  # only ACTIVE + non-NEW


@pytest.mark.anyio
async def test_list_decks_given_multiple_variants_per_pool_expect_studied_count_deduped(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Variant Deck")
    pool = await CardPoolFactory.create(key="variant-progress")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.ACTIVE,
        state=CardState.REVIEW,
    )

    result = await deck_service(async_session).list_decks(user_id=user.id)

    assert len(result) == 1
    assert result[0].card_count == EXPECTED_DECK_CARD_COUNT
    assert result[0].studied_count == 1


@pytest.mark.anyio
async def test_list_decks_empty(async_session: AsyncSession) -> None:
    user = await UserFactory.create()
    result = await deck_service(async_session).list_decks(user_id=user.id)
    assert result == []


@pytest.mark.anyio
async def test_list_decks_unsubscribed_deck(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Unsubscribed")
    pool = await CardPoolFactory.create(key="unsub-pool")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)

    result = await deck_service(async_session).list_decks(user_id=user.id)

    assert len(result) == 1
    assert result[0].is_subscribed is False
    assert result[0].studied_count == 0
    assert result[0].card_count == 1
