import asyncio
from datetime import datetime
from datetime import timedelta
from datetime import UTC
from math import isclose
from typing import Any
from typing import cast
from uuid import uuid4

import pytest
from fsrs import Rating
from sqlalchemy import delete
from sqlalchemy import func
from sqlalchemy import inspect
from sqlalchemy import literal
from sqlalchemy import null
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import EnrollmentShape
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.deck_service import FlashcardDeckService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.flashcards.user_cards_service import MyCardsService
from flyt.apps.flashcards.user_cards_service import derive_mastery_bucket
from flyt.apps.flashcards.user_cards_service import mastery_bucket_sql_case
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserSettings
from flyt.apps.users.services import UserLemmaService
from flyt.libs.utils.date import now as now_utc
from tests.factories import CardPoolFactory
from tests.factories import DeckFactory
from tests.factories import DefinitionFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import LessonFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import UserSettingsFactory
from tests.factories import WordFormFactory
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import params_contain
from tests.helpers.sql_log import statements_reading

EXPECTED_PROMOTABLE_NEW_COUNT = 3
EXPECTED_NEW_CARDS_AFTER_DAILY_LIMIT = 2
EXPECTED_PROMOTED_CARD_COUNT = 2
EXPECTED_LEARNING_AND_RELEARNING_COUNT = 2
EXPECTED_DAILY_NEW_COUNT = 2
EXPECTED_SUBSCRIBED_USER_CARD_COUNT = 2
EXPECTED_CONCURRENT_REVIEW_COUNT = 2
EXPECTED_Q_SEARCH_ALL_CARDS_TOTAL = 2
EXPECTED_Q_FACET_BUCKET_ALL_CARDS_TOTAL = 6
EXPECTED_REVIEW_LOG_COUNT = 2
EXPECTED_EXISTING_STABILITY = 42.0


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


@pytest.mark.anyio
async def test_user_card_has_introduced_at_default_none(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    uc = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)
    assert uc.introduced_at is None


@pytest.mark.anyio
async def test_issue_due_cards_given_lesson_card_expect_packet_not_loaded(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    pool = await CardPoolFactory.create(lesson=lesson)
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )
    await async_session.flush()
    async_session.expunge_all()

    result = await review_service(async_session).issue_due_cards(user_id=user.id)

    loaded_pool = result[0].card.pool
    assert loaded_pool is not None
    assert "lesson" in inspect(loaded_pool).unloaded


@pytest.mark.anyio
async def test_due_set_given_pool_without_addable_variant_expect_count_and_served_agree(
    async_session: AsyncSession,
) -> None:
    """Regression guard: the counted due set and the served due set are one set.

    The non-addable pool ranks first, so with a one-card allowance selection
    spent the quota on it and silently dropped the card, while counting had
    excluded it up front — the dashboard promised a new card the session
    never served.
    """
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=1)
    non_addable_pool = await CardPoolFactory.create(frequency_rank=1)
    await FlashCardFactory.create(pool=non_addable_pool, is_addable=False)
    await UserCardFactory.create(user=user, pool=non_addable_pool, state=CardState.NEW)
    addable_pool = await CardPoolFactory.create(frequency_rank=2)
    await FlashCardFactory.create(pool=addable_pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=addable_pool, state=CardState.NEW)

    svc = review_service(async_session)
    counts = await svc.count_due_states(user_id=user.id)
    served_new = [
        dc
        for dc in await svc.issue_due_cards(user_id=user.id)
        if dc.user_card.state == CardState.NEW
    ]

    assert counts.new == len(served_new)


@pytest.mark.anyio
async def test_due_set_given_non_addable_pool_expect_daily_allowance_not_consumed(
    async_session: AsyncSession,
) -> None:
    """The daily-new allowance is only spent on cards that can be served."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=1)
    non_addable_pool = await CardPoolFactory.create(frequency_rank=1)
    await FlashCardFactory.create(pool=non_addable_pool, is_addable=False)
    await UserCardFactory.create(user=user, pool=non_addable_pool, state=CardState.NEW)
    addable_pool = await CardPoolFactory.create(frequency_rank=2)
    addable_variant = await FlashCardFactory.create(pool=addable_pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=addable_pool, state=CardState.NEW)

    served = await review_service(async_session).issue_due_cards(user_id=user.id)

    assert [dc.card.id for dc in served] == [addable_variant.id]


# --- My Cards q search ---


def my_cards_service(session: AsyncSession) -> MyCardsService:
    return MyCardsService(session)


@pytest.mark.anyio
async def test_list_user_cards_given_q_matching_lemma_word_expect_card_returned(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    match = await _make_search_vocab_card(user, word="katt", translation="cat")
    await _make_search_vocab_card(user, word="hund", translation="dog")

    result = await my_cards_service(async_session).list_user_cards(user.id, q="katt")

    assert [c.user_card_id for c in result.cards] == [match.id]
    assert result.total == EXPECTED_Q_SEARCH_ALL_CARDS_TOTAL


@pytest.mark.anyio
async def test_list_user_cards_given_q_matching_word_form_expect_card_returned(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_search_vocab_card(
        user, word="gå", translation="go", forms=["gikk", "gått"]
    )
    await _make_search_vocab_card(user, word="spise", translation="eat")

    result = await my_cards_service(async_session).list_user_cards(user.id, q="gikk")

    assert len(result.cards) == 1
    assert result.cards[0].label == "gå"


@pytest.mark.anyio
async def test_list_user_cards_given_q_matching_translation_expect_card_returned(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_search_vocab_card(user, word="hus", translation="house")
    await _make_search_vocab_card(user, word="hund", translation="dog")

    result = await my_cards_service(async_session).list_user_cards(user.id, q="house")

    assert len(result.cards) == 1
    assert result.cards[0].label == "hus"


@pytest.mark.anyio
async def test_list_user_cards_given_q_with_mixed_case_and_whitespace_expect_normalized_match(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    match = await _make_search_vocab_card(user, word="katt", translation="cat")
    await _make_search_vocab_card(user, word="hund", translation="dog")

    result = await my_cards_service(async_session).list_user_cards(user.id, q=" KaTt ")

    assert [c.user_card_id for c in result.cards] == [match.id]


@pytest.mark.anyio
async def test_list_user_cards_given_q_with_percent_character_expect_literal_match(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    match = await _make_search_vocab_card(user, word="salg", translation="50% off")
    await _make_search_vocab_card(user, word="katt", translation="cat")

    result = await my_cards_service(async_session).list_user_cards(user.id, q="%")

    assert [c.user_card_id for c in result.cards] == [match.id]


@pytest.mark.anyio
async def test_list_user_cards_given_q_with_facet_bucket_and_pagination_expect_consistent_totals(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_search_vocab_card(
        user, word="alpha", translation="target one", stability=50.0
    )
    await _make_search_vocab_card(
        user, word="beta", translation="target two", stability=60.0
    )
    await _make_search_vocab_card(
        user, word="gamma", translation="target three", stability=70.0
    )
    await _make_search_vocab_card(
        user, word="delta", translation="target four", stability=5.0
    )
    await _make_search_vocab_card(
        user, word="epsilon", translation="unrelated", stability=80.0
    )
    await _make_search_grammar_card(
        user, title="target grammar", pool_key="obj_target_grammar", stability=40.0
    )

    service = my_cards_service(async_session)
    page1 = await service.list_user_cards(
        user.id, q="target", facet="vocab", bucket="known", limit=1
    )
    page3 = await service.list_user_cards(
        user.id, q="target", facet="vocab", bucket="known", limit=1, page=3
    )

    assert [c.label for c in page1.cards] == ["alpha"]
    assert page1.has_more is True
    assert [c.label for c in page3.cards] == ["gamma"]
    assert page3.has_more is False
    assert page1.total == EXPECTED_Q_FACET_BUCKET_ALL_CARDS_TOTAL
    assert page1.counts_by_bucket == {
        "not_started": 0,
        "learning": 0,
        "familiar": 1,
        "known": 5,
        "mastered": 0,
    }


@pytest.mark.anyio
async def test_list_user_cards_given_same_filters_with_and_without_q_expect_consistent_ordering(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_search_vocab_card(user, word="a", translation="zeta one", stability=1.0)
    await _make_search_vocab_card(user, word="b", translation="zeta two", stability=2.0)
    await _make_search_grammar_card(
        user,
        title="zeta grammar",
        pool_key="obj_zeta_grammar",
        description="zeta drill",
        stability=2.5,
    )
    await _make_search_vocab_card(
        user, word="c", translation="zeta three", stability=3.0
    )

    service = my_cards_service(async_session)
    with_q = await service.list_user_cards(user.id, q="zeta")
    without_q = await service.list_user_cards(user.id)

    assert [c.user_card_id for c in with_q.cards] == [
        c.user_card_id for c in without_q.cards
    ]
    assert with_q.has_more == without_q.has_more
    assert with_q.total == without_q.total
    assert with_q.counts_by_bucket == without_q.counts_by_bucket


@pytest.mark.anyio
async def test_list_user_cards_given_q_matching_humanized_pool_key_expect_card_returned(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    match = await _make_search_grammar_card(
        user, title="irrelevant title", pool_key="obj_past_tense"
    )
    await _make_search_grammar_card(
        user, title="unrelated", pool_key="obj_genitive_case"
    )

    service = my_cards_service(async_session)
    by_humanized_label = await service.list_user_cards(user.id, q="past tense")
    by_stripped_prefix = await service.list_user_cards(user.id, q="obj_")

    assert [c.user_card_id for c in by_humanized_label.cards] == [match.id]
    assert by_stripped_prefix.cards == []


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("state", "stability"),
    [
        (CardState.NEW, None),
        (CardState.NEW, 999.0),
        (CardState.LEARNING, None),
        (CardState.LEARNING, 5.0),
        (CardState.RELEARNING, None),
        (CardState.RELEARNING, 5.0),
        (CardState.REVIEW, None),
        (CardState.REVIEW, 0.0),
        (CardState.REVIEW, 29.0),
        (CardState.REVIEW, 30.0),
        (CardState.REVIEW, 119.0),
        (CardState.REVIEW, 120.0),
        (CardState.REVIEW, 500.0),
    ],
)
async def test_mastery_bucket_given_boundary_values_expect_sql_and_python_agree(
    async_session: AsyncSession, state: CardState, stability: float | None
) -> None:
    stability_lit = literal(stability) if stability is not None else null()
    sql_bucket = await async_session.scalar(
        select(
            mastery_bucket_sql_case(
                literal(state, type_=UserCard.state.type), stability_lit
            )
        )
    )

    assert sql_bucket == derive_mastery_bucket(state, stability)


async def _create_user_card_with_variant(
    user,
    state: CardState = CardState.NEW,
    due_at: datetime | None = None,
    deck=None,
) -> tuple[UserCard, object, object]:
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(pool=pool, deck=deck, is_addable=True)
    user_card_kwargs = {"user": user, "pool": pool, "state": state}
    if due_at is not None:
        user_card_kwargs["due_at"] = due_at
    user_card = await UserCardFactory.create(**user_card_kwargs)
    return user_card, card, pool


def test_format_interval_buckets() -> None:
    from datetime import timedelta

    from flyt.apps.flashcards.review_service import format_interval

    assert format_interval(timedelta(seconds=30)) == "1m"  # floor at 1m
    assert format_interval(timedelta(minutes=10)) == "10m"
    assert format_interval(timedelta(hours=5)) == "5h"
    assert format_interval(timedelta(days=4)) == "4d"
    assert format_interval(timedelta(days=90)) == "3mo"
    assert format_interval(timedelta(days=800)) == "2y"


@pytest.mark.anyio
async def test_rating_previews_returns_all_four_intervals(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    uc = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)

    previews = review_service(async_session).rating_previews(uc)

    assert set(previews) == {"again", "hard", "good", "easy"}
    assert all(isinstance(v, str) and v for v in previews.values())
    # Again repeats soonest (a minutes-step); Easy graduates furthest out.
    assert previews["again"].endswith("m")


@pytest.mark.anyio
async def test_issue_due_cards_given_due_card_expect_all_four_rating_previews(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user)
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )

    due = await review_service(async_session).issue_due_cards(user_id=user.id)

    assert due
    assert set(due[0].rating_previews) == {"again", "hard", "good", "easy"}


@pytest.mark.anyio
async def test_review_promotes_upcoming_card_to_active(
    async_session: AsyncSession,
) -> None:
    """Reviewing an UPCOMING card (surfaced via the read-path drip) must flip it
    ACTIVE, else every ACTIVE-filtered read would orphan it permanently."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user)
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    uc = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.UPCOMING,
    )

    service = review_service(async_session)
    due = await service.issue_due_cards(user.id)
    assert due[0].card.id == variant.id
    reviewed = await service.review_card(
        user_id=user.id, user_card_id=uc.id, rating=3, card_id=due[0].card.id
    )

    assert reviewed.enrollment_state == Enrollment.ACTIVE
    assert reviewed.state != CardState.NEW


@pytest.mark.anyio
async def test_count_due_states_counts_promotable_upcoming_new(
    async_session: AsyncSession,
) -> None:
    """New count includes promotable addable UPCOMING cards, matching what
    issue_due_cards will surface (so the dashboard badge isn't 0 for fresh subs)."""
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=5)
    for _ in range(3):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
        )

    counts = await review_service(async_session).count_due_states(user_id=user.id)
    assert counts.new == EXPECTED_PROMOTABLE_NEW_COUNT


@pytest.mark.anyio
async def test_issue_due_cards_given_mixed_due_dates_expect_due_and_today_learning_not_future(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    now_n = datetime.now(UTC).replace(tzinfo=None)

    async def mk(state: CardState, off_min: int):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        return await UserCardFactory.create(
            user=user,
            pool=pool,
            state=state,
            due_at=now_n + timedelta(minutes=off_min),
        )

    due_review = await mk(CardState.REVIEW, -60)  # due now -> included
    today_step = await mk(CardState.LEARNING, 5)  # due in 5m, same day -> included
    future_rev = await mk(CardState.REVIEW, 60 * 24 * 2)  # due in 2 days -> excluded
    svc = review_service(async_session)
    ids = {dc.user_card.id for dc in await svc.issue_due_cards(user_id=user.id)}
    assert due_review.id in ids
    assert today_step.id in ids
    assert future_rev.id not in ids


@pytest.mark.anyio
async def test_issue_due_cards_given_new_cards_beyond_daily_limit_expect_topup_capped_to_limit(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    for _ in range(5):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            due_at=datetime.now(UTC).replace(tzinfo=None),
        )
    svc = review_service(async_session)
    new_cards = [
        dc
        for dc in await svc.issue_due_cards(user_id=user.id)
        if dc.user_card.state == CardState.NEW
    ]
    assert len(new_cards) == EXPECTED_NEW_CARDS_AFTER_DAILY_LIMIT


@pytest.mark.anyio
async def test_promote_upcoming_to_fill_flips_want_respects_exclude_orders_by_rank(
    async_session: AsyncSession,
) -> None:
    from flyt.apps.flashcards.models import Enrollment

    user = await UserFactory.create()
    # Three UPCOMING pools with frequency_ranks 30, 10, 20 (insertion order ≠
    # rank order so we can verify the ORDER BY). Each has an addable FlashCard.
    pools_by_rank: dict[int, CardPool] = {}
    for rank in (30, 10, 20):
        pool = await CardPoolFactory.create(frequency_rank=rank)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.NEW,
            enrollment_state=Enrollment.UPCOMING,
            due_at=datetime.now(UTC).replace(tzinfo=None),
        )
        pools_by_rank[rank] = pool

    svc = review_service(async_session)

    promoted = await svc.promote_upcoming_to_fill(
        user_id=user.id,
        want=2,
        exclude_pool_ids={pools_by_rank[30].id},
    )

    assert len(promoted) == EXPECTED_PROMOTED_CARD_COUNT
    # Excluded pool 30; remaining ordered by rank: 10 then 20.
    assert [uc.pool_id for uc in promoted] == [
        pools_by_rank[10].id,
        pools_by_rank[20].id,
    ]
    for uc in promoted:
        assert uc.enrollment_state == Enrollment.ACTIVE
        assert uc.state == CardState.NEW
        assert uc.due_at is not None


@pytest.mark.anyio
async def test_issue_due_cards_given_queued_cards_expect_ordered_cards_with_payloads(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    now_n = datetime.now(UTC).replace(tzinfo=None)
    later_pool = await CardPoolFactory.create()
    later_card = await FlashCardFactory.create(pool=later_pool, is_addable=True)
    later_user_card = await UserCardFactory.create(
        user=user,
        pool=later_pool,
        state=CardState.REVIEW,
        due_at=now_n - timedelta(minutes=5),
    )
    earlier_pool = await CardPoolFactory.create()
    earlier_card = await FlashCardFactory.create(pool=earlier_pool, is_addable=True)
    earlier_user_card = await UserCardFactory.create(
        user=user,
        pool=earlier_pool,
        state=CardState.REVIEW,
        due_at=now_n - timedelta(minutes=60),
    )

    service = review_service(async_session)

    result = await service.issue_due_cards(user_id=user.id)

    assert [dc.user_card.id for dc in result] == [
        earlier_user_card.id,
        later_user_card.id,
    ]
    assert result[0].card.id == earlier_card.id
    assert result[1].card.id == later_card.id


@pytest.mark.anyio
async def test_issue_due_cards_given_empty_queue_expect_empty_list(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    service = review_service(async_session)

    result = await service.issue_due_cards(user_id=user.id)

    assert result == []


@pytest.mark.anyio
async def test_issue_due_cards_given_quick_mode_expect_first_ten_cards_only(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    queued_user_cards = []
    base = datetime.now(UTC).replace(tzinfo=None)

    for minute in range(12):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        user_card = await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.LEARNING,
            due_at=base + timedelta(minutes=minute),
        )
        queued_user_cards.append(user_card)

    service = review_service(async_session)

    result = await service.issue_due_cards(user_id=user.id, mode="quick")

    assert [dc.user_card.id for dc in result] == [
        card.id for card in queued_user_cards[:10]
    ]
    assert [card.active_card_id for card in queued_user_cards[:10]] == [
        due_card.card.id for due_card in result
    ]
    assert all(card.last_shown_card_id is None for card in queued_user_cards[10:])


@pytest.mark.anyio
async def test_issue_due_cards_given_active_issuance_expect_same_variant_on_repeat(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    first = await FlashCardFactory.create(pool=pool, is_addable=True)
    second = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )

    service = review_service(async_session)
    first_issue = await service.issue_due_cards(user.id)
    second_issue = await service.issue_due_cards(user.id)

    assert len(first_issue) == 1
    assert second_issue[0].card.id == first_issue[0].card.id
    assert user_card.active_card_id == first_issue[0].card.id
    assert user_card.last_shown_card_id is None
    assert first_issue[0].card.id in {first.id, second.id}


@pytest.mark.anyio
async def test_issue_due_cards_given_resolved_card_expect_rotation_history_preserved(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    first = await FlashCardFactory.create(pool=pool, is_addable=True)
    second = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )
    service = review_service(async_session)

    issued = (await service.issue_due_cards(user.id))[0]
    await service.review_card(user.id, user_card.id, Rating.Good, issued.card.id)
    user_card.due_at = datetime.now(UTC).replace(tzinfo=None)
    await async_session.flush()

    rotated = (await service.issue_due_cards(user.id))[0]

    assert rotated.card.id != issued.card.id
    assert rotated.card.id in {first.id, second.id}
    assert user_card.active_card_id == rotated.card.id
    assert user_card.last_shown_card_id == issued.card.id


@pytest.mark.anyio
async def test_count_due_states_splits_eligible_cards_by_state(
    async_session: AsyncSession,
) -> None:
    """Seed UserCards in each eligible/non-eligible state and assert the split.

    Eligible: LEARNING/RELEARNING due < start-of-next-day, REVIEW due <= now,
    and ACTIVE NEW capped by ``daily_new_limit``. Non-eligible: UPCOMING NEW,
    REVIEW due in 2 days, NEW beyond the daily limit.
    """
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    now_n = datetime.now(UTC).replace(tzinfo=None)

    async def mk(state, due_offset_min, enrollment=Enrollment.ACTIVE):
        pool = await CardPoolFactory.create()
        await FlashCardFactory.create(pool=pool, is_addable=True)
        return await UserCardFactory.create(
            user=user,
            pool=pool,
            state=state,
            due_at=now_n + timedelta(minutes=due_offset_min),
            enrollment_state=enrollment,
        )

    # Eligible learning (due earlier today) + relearning.
    await mk(CardState.LEARNING, -10)
    await mk(CardState.RELEARNING, -5)
    # Eligible review (due now).
    await mk(CardState.REVIEW, -60)
    # Eligible NEW: daily_new_limit is 2, so exactly 2 are counted.
    await mk(CardState.NEW, 0)
    await mk(CardState.NEW, 0)
    # Extra NEW beyond the cap (not counted).
    await mk(CardState.NEW, 0)

    # Non-eligible: REVIEW due in 2 days.
    await mk(CardState.REVIEW, 60 * 24 * 2)
    # Non-eligible: UPCOMING NEW (not ACTIVE).
    await mk(CardState.NEW, 0, enrollment=Enrollment.UPCOMING)

    svc = review_service(async_session)
    counts = await svc.count_due_states(user_id=user.id)

    assert counts.learning == EXPECTED_LEARNING_AND_RELEARNING_COUNT
    assert counts.review == 1
    assert counts.new == EXPECTED_DAILY_NEW_COUNT


@pytest.mark.anyio
async def test_subscribe_to_deck_given_new_user_and_deck_expect_user_cards_created(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool_a = await CardPoolFactory.create(key="pool-a")
    pool_b = await CardPoolFactory.create(key="pool-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)
    await FlashCardFactory.create(deck=deck, is_addable=True)
    service = deck_service(async_session)

    result = await service.subscribe_to_deck(user_id=user.id, deck_id=deck.id)

    assert result is None
    created_user_cards = await async_session.scalar(
        select(func.count(UserCard.id)).where(UserCard.user_id == user.id)
    )
    assert created_user_cards == EXPECTED_SUBSCRIBED_USER_CARD_COUNT


@pytest.mark.anyio
async def test_subscribe_to_deck_given_existing_subscription_expect_idempotent_counts(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool = await CardPoolFactory.create(key="pool-a")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pool)
    service = deck_service(async_session)

    result = await service.subscribe_to_deck(user_id=user.id, deck_id=deck.id)

    assert result is None
    total_user_cards = await async_session.scalar(
        select(func.count(UserCard.id))
        .where(UserCard.user_id == user.id)
        .where(UserCard.pool_id == pool.id)
    )
    assert total_user_cards == 1


@pytest.mark.anyio
async def test_subscribe_to_deck_given_concurrent_insert_after_snapshot_expect_no_raise(
    async_session: AsyncSession,
) -> None:
    """Simulate a race: another actor inserts the UserCard row for this pool
    in between subscribe_to_deck's read of existing_pool_ids and its insert.
    The DB-level uq_user_card_pool constraint would be violated by a plain
    INSERT; the ON CONFLICT DO NOTHING guard must absorb it as a no-op instead
    of bubbling an IntegrityError (and 500) to the caller.
    """
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool = await CardPoolFactory.create(key="race-pool")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    service = deck_service(async_session)

    real_scalars = async_session.scalars
    call_count = 0

    async def scalars_with_injected_race(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        result = await real_scalars(*args, **kwargs)
        if call_count == 1:
            # First call is the existing_pool_ids snapshot, taken before the
            # pool is subscribed. Insert the "concurrent" row right after the
            # snapshot is read but before subscribe_to_deck issues its insert.
            await async_session.execute(
                UserCard.__table__.insert().values(
                    user_id=user.id,
                    pool_id=pool.id,
                    due_at=datetime.now(UTC),
                    state=CardState.NEW,
                    enrollment_state="upcoming",
                )
            )
            await async_session.flush()
        return result

    async_session.scalars = scalars_with_injected_race  # type: ignore[method-assign]
    try:
        await service.subscribe_to_deck(user_id=user.id, deck_id=deck.id)
    finally:
        async_session.scalars = real_scalars  # type: ignore[method-assign]

    total_user_cards = await async_session.scalar(
        select(func.count(UserCard.id))
        .where(UserCard.user_id == user.id)
        .where(UserCard.pool_id == pool.id)
    )
    assert total_user_cards == 1


@pytest.mark.anyio
async def test_enroll_pools_given_owned_pool_expect_scheduling_preserved(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    """Re-enrollment must leave owned UserCards untouched and insert only the
    missing pools with the requested shape."""
    user = await UserFactory.create()
    owned_pool = await CardPoolFactory.create()
    new_pool = await CardPoolFactory.create()
    reviewed_at = datetime.now(UTC).replace(tzinfo=None)
    due_at = reviewed_at + timedelta(days=3)
    existing = await UserCardFactory.create(
        user=user,
        pool=owned_pool,
        state=CardState.REVIEW,
        fsrs_stability=42.0,
        due_at=due_at,
        last_review_at=reviewed_at,
    )

    await card_service(async_session).enroll_pools(
        user.id,
        [owned_pool.id, new_pool.id],
        shape=EnrollmentShape.ACTIVATE_NOW,
    )

    await async_session.refresh(existing)
    assert existing.state is CardState.REVIEW
    assert isclose(existing.fsrs_stability or 0.0, EXPECTED_EXISTING_STABILITY)
    assert existing.due_at == due_at
    assert existing.enrollment_state is Enrollment.ACTIVE
    assert existing.introduced_at is None

    inserted = await async_session.scalar(
        select(UserCard)
        .where(UserCard.user_id == user.id)
        .where(UserCard.pool_id == new_pool.id)
    )
    assert inserted is not None
    assert inserted.state is CardState.NEW
    assert inserted.enrollment_state is Enrollment.ACTIVE
    assert inserted.introduced_at is not None


@pytest.mark.anyio
async def test_enroll_pools_given_candidates_expect_existing_pool_read_scoped(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    """The already-owned pre-read must filter on the candidate pools instead
    of scanning the learner's whole collection."""
    user = await UserFactory.create()
    outside_pool = await CardPoolFactory.create()
    await UserCardFactory.create(user=user, pool=outside_pool)
    candidate = await CardPoolFactory.create()

    with capture_sql(async_session) as executed:
        await card_service(async_session).enroll_pools(
            user.id,
            [candidate.id],
            shape=EnrollmentShape.ACTIVATE_NOW,
        )

    pre_reads = statements_reading(executed, "flashcard_user_cards")
    assert pre_reads, "existing-pool pre-read did not run"
    for _statement, parameters in pre_reads:
        assert params_contain(parameters, candidate.id)
        assert not params_contain(parameters, outside_pool.id)


@pytest.mark.anyio
async def test_review_card_given_existing_user_card_expect_fsrs_fields_set(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user)
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    due_at = datetime.now(UTC) - timedelta(hours=1)
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        due_at=due_at.replace(tzinfo=None),
        state=CardState.NEW,
    )

    service = review_service(async_session)

    due = await service.issue_due_cards(user.id)
    assert due[0].card.id == variant.id
    reviewed_user_card = await service.review_card(
        user_id=user_card.user_id,
        user_card_id=user_card.id,
        rating=3,
        card_id=due[0].card.id,
    )
    updated_user_card = await async_session.get(UserCard, user_card.id)
    assert updated_user_card is not None

    review_log = await async_session.scalar(
        select(StatsReviewLog).where(StatsReviewLog.user_card_id == user_card.id)
    )

    assert reviewed_user_card.id == user_card.id
    assert updated_user_card.fsrs_stability is not None
    assert updated_user_card.fsrs_difficulty is not None
    assert updated_user_card.due_at.tzinfo is None
    assert updated_user_card.last_shown_card_id == variant.id
    assert review_log is not None
    assert review_log.user_id == user_card.user_id
    assert review_log.rating == Rating.Good
    assert review_log.reviewed_at == updated_user_card.last_review_at
    assert updated_user_card.state in {
        CardState.LEARNING,
        CardState.REVIEW,
        CardState.RELEARNING,
    }


@pytest.mark.anyio
async def test_review_sets_introduced_at_on_first_transition(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user)
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    uc = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)
    svc = review_service(async_session)
    due = await svc.issue_due_cards(user.id)
    assert due[0].card.id == variant.id
    reviewed = await svc.review_card(
        user_id=user.id, user_card_id=uc.id, rating=3, card_id=due[0].card.id
    )
    assert reviewed.introduced_at is not None
    assert reviewed.last_shown_card_id == variant.id
    assert reviewed.active_card_id is None
    first = reviewed.introduced_at
    # Reissue the now-due card before the second review.
    uc.due_at = datetime.now(UTC).replace(tzinfo=None)
    second_due = await svc.issue_due_cards(user.id)
    again = await svc.review_card(
        user_id=user.id,
        user_card_id=uc.id,
        rating=3,
        card_id=second_due[0].card.id,
    )
    assert again.introduced_at == first


@pytest.mark.anyio
async def test_review_card_given_deleted_user_card_expect_card_not_found_error(
    async_session: AsyncSession,
) -> None:
    user_card, variant, _ = await _create_user_card_with_variant(
        await UserFactory.create(),
        due_at=(datetime.now(UTC) - timedelta(hours=1)).replace(tzinfo=None),
    )
    user_id = user_card.user_id
    user_card_id = user_card.id
    variant_id = variant.id
    await async_session.delete(user_card)
    await async_session.commit()

    service = review_service(async_session)

    with pytest.raises(CardNotFoundError):
        await service.review_card(
            user_id=user_id, user_card_id=user_card_id, rating=3, card_id=variant_id
        )


@pytest.mark.anyio
async def test_add_lemma_to_deck_given_mastered_lemma_preserves_mastery(
    async_session: AsyncSession,
) -> None:
    """Activation does not care about mastery; existing is_mastered is preserved."""
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(
        lemma=lemma,
        key="restart-study-pool",
    )
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserLemmaFactory.create(
        user=user,
        lemma=lemma,
        is_mastered=True,
    )
    service = card_service(async_session)

    await service.add_lemma_to_deck(user.id, lemma.uuid)

    user_card = await async_session.scalar(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.pool_id == pool.id)
    )
    from flyt.apps.users.models import UserLemma

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )

    assert user_card is not None
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


# --- Shared vocabulary pool/card builder tests ---


@pytest.mark.anyio
async def test_find_or_create_lemma_pool_with_definition_card_given_missing_pool_expect_pool_and_card_created(
    async_session: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(primary_translation="fish")
    await DefinitionFactory.create(
        lemma=lemma,
        definition="dyr som lever i vann",
        translation="animal that lives in water",
        examples_json=[{"no": "en fisk", "en": None}],
    )
    service = card_service(async_session)

    pool = await service.find_or_create_lemma_pool_with_definition_card(lemma)

    assert pool.lemma_id == lemma.id
    card = await async_session.scalar(
        select(FlashCard).where(FlashCard.pool_id == pool.id)
    )
    assert card is not None
    assert card.type == CardType.DEFINITION
    assert card.is_addable is True
    assert card.payload_json["lemma_uuid"] == str(lemma.uuid)
    assert card.payload_json["primary_translation"] == "fish"


@pytest.mark.anyio
async def test_find_or_create_lemma_pool_with_definition_card_given_existing_card_expect_card_preserved(
    async_session: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(primary_translation="new gloss")
    pool = await CardPoolFactory.create(lemma=lemma)
    await FlashCardFactory.create(
        pool=pool,
        type=CardType.DEFINITION,
        payload_json={"word": "old", "pos": "noun", "primary_translation": "old gloss"},
        is_addable=True,
    )
    service = card_service(async_session)

    returned = await service.find_or_create_lemma_pool_with_definition_card(lemma)

    assert returned.id == pool.id
    card_count = await async_session.scalar(
        select(func.count(FlashCard.id)).where(FlashCard.pool_id == pool.id)
    )
    assert card_count == 1


# --- Shared activation command tests ---


@pytest.mark.anyio
async def test_activate_pool_for_user_given_missing_card_expect_active_card_and_user_lemma(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    service = card_service(async_session)

    user_card = await service.activate_pool_for_user(user.id, pool.id)

    assert user_card.enrollment_state == Enrollment.ACTIVE
    assert user_card.state == CardState.NEW
    assert user_card.due_at is not None
    assert user_card.introduced_at is not None
    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is False


@pytest.mark.anyio
async def test_activate_pool_for_user_given_upcoming_card_expect_promoted_in_place(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    existing = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.UPCOMING,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )
    service = card_service(async_session)

    activated = await service.activate_pool_for_user(user.id, pool.id)

    assert activated.id == existing.id
    assert activated.enrollment_state == Enrollment.ACTIVE
    assert activated.introduced_at is not None


@pytest.mark.anyio
async def test_activate_pool_for_user_given_existing_active_card_expect_schedule_preserved(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    original_due_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=3)
    existing = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        enrollment_state=Enrollment.ACTIVE,
        due_at=original_due_at,
        introduced_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=5),
    )
    service = card_service(async_session)

    activated = await service.activate_pool_for_user(user.id, pool.id)

    assert activated.id == existing.id
    assert activated.state == CardState.REVIEW
    assert activated.due_at == original_due_at


@pytest.mark.anyio
async def test_activate_pool_for_user_given_lesson_pool_expect_no_user_lemma(
    async_session: AsyncSession,
) -> None:
    """Lesson-owned pools (null lemma_id) must not trigger UserLemma creation."""
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    service = card_service(async_session)

    await service.activate_pool_for_user(user.id, pool.id)

    user_lemma_count = await async_session.scalar(
        select(func.count(UserLemma.id)).where(UserLemma.user_id == user.id)
    )
    assert user_lemma_count == 0


# --- UPCOMING drip backfills UserLemma ---


@pytest.mark.anyio
async def test_issue_due_cards_given_upcoming_lemma_card_expect_user_lemma_backfilled(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, frequency_rank=1)
    await FlashCardFactory.create(pool=pool, is_addable=True, type=CardType.DEFINITION)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.NEW,
        enrollment_state=Enrollment.UPCOMING,
        due_at=datetime.now(UTC).replace(tzinfo=None),
    )
    service = review_service(async_session)

    await service.issue_due_cards(user.id)

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None


# --- Concurrency: serialized review transitions (R-001, D-001) ---


class _ReviewLoadBarrierSession:
    """Pause after the review's UserCard select returns, before it is mutated."""

    def __init__(
        self,
        delegate: AsyncSession,
        loaded: asyncio.Event,
        release: asyncio.Event | None = None,
    ) -> None:
        self._delegate = delegate
        self._loaded = loaded
        self._release = release
        self._coordinated = False

    async def scalar(self, statement: Any) -> Any:
        result = await self._delegate.scalar(statement)
        if isinstance(result, UserCard) and not self._coordinated:
            self._coordinated = True
            self._loaded.set()
            if self._release is not None:
                await asyncio.wait_for(self._release.wait(), timeout=2)
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self._delegate, name)


def _independent_session(
    *,
    review_loaded: asyncio.Event | None = None,
    release_review: asyncio.Event | None = None,
) -> AsyncSession:
    """Create a session backed by its own connection/transaction.

    The normal ``db`` fixture wraps everything in a savepoint on one shared
    connection, so it cannot demonstrate row-level locking. Independent
    sessions each get their own connection and real transaction boundary.
    """
    from tests.conftest import async_engine

    session = AsyncSession(bind=async_engine, expire_on_commit=False)
    if review_loaded is None:
        return session
    return cast(
        AsyncSession,
        _ReviewLoadBarrierSession(session, review_loaded, release_review),
    )


async def _seed_committed_review_fixture() -> dict[str, int]:
    """Insert user, settings, lemma, two pools, two variants, and two NEW
    user cards.

    Two separate pools are needed because (user_id, pool_id) is unique.
    Data is committed on a dedicated seed session so that independent
    connections (used by the concurrent reviews) can see it.
    """
    session = _independent_session()
    try:
        token = uuid4().hex
        user = User(
            email=f"concurrency-test-{token}@example.com", display_name="Tester"
        )
        session.add(user)
        await session.flush()

        session.add(UserSettings(user_id=user.id, daily_new_limit=20))

        lemma_single = Lemma(
            word="testord1",
            pos=LemmaPos.NOUN,
            hgno=1,
            primary_translation="test word one",
        )
        lemma_concurrent = Lemma(
            word="testord2",
            pos=LemmaPos.NOUN,
            hgno=1,
            primary_translation="test word two",
        )
        session.add_all([lemma_single, lemma_concurrent])
        await session.flush()

        pool_single = CardPool(
            lemma_id=lemma_single.id, key=f"concurrency-test-pool-single-{token}"
        )
        pool_concurrent = CardPool(
            lemma_id=lemma_concurrent.id,
            key=f"concurrency-test-pool-concurrent-{token}",
        )
        session.add_all([pool_single, pool_concurrent])
        await session.flush()

        variant_single = FlashCard(
            pool_id=pool_single.id,
            type=CardType.DEFINITION,
            is_addable=True,
            payload_json={"word": "testord1", "pos": "noun"},
        )
        variant_concurrent = FlashCard(
            pool_id=pool_concurrent.id,
            type=CardType.DEFINITION,
            is_addable=True,
            payload_json={"word": "testord2", "pos": "noun"},
        )
        session.add_all([variant_single, variant_concurrent])
        await session.flush()

        due = now_utc()
        uc_single = UserCard(
            user_id=user.id,
            pool_id=pool_single.id,
            last_shown_card_id=variant_single.id,
            active_card_id=variant_single.id,
            state=CardState.NEW,
            enrollment_state=Enrollment.ACTIVE,
            due_at=due,
        )
        uc_concurrent = UserCard(
            user_id=user.id,
            pool_id=pool_concurrent.id,
            last_shown_card_id=variant_concurrent.id,
            active_card_id=variant_concurrent.id,
            state=CardState.NEW,
            enrollment_state=Enrollment.ACTIVE,
            due_at=due,
        )
        session.add_all([uc_single, uc_concurrent])
        await session.flush()

        ids = {
            "user_id": user.id,
            "lemma_single_id": lemma_single.id,
            "lemma_concurrent_id": lemma_concurrent.id,
            "pool_single_id": pool_single.id,
            "pool_concurrent_id": pool_concurrent.id,
            "variant_single_id": variant_single.id,
            "variant_concurrent_id": variant_concurrent.id,
            "uc_single_id": uc_single.id,
            "uc_concurrent_id": uc_concurrent.id,
        }
        await session.commit()
        return ids
    finally:
        await session.close()


async def _cleanup_committed_review_fixture(ids: dict[str, int]) -> None:
    """Delete seed rows created outside the savepoint-isolated fixture."""
    session = _independent_session()
    try:
        await session.execute(
            delete(StatsReviewLog).where(StatsReviewLog.user_id == ids["user_id"])
        )
        await session.execute(
            delete(UserLemma).where(UserLemma.user_id == ids["user_id"])
        )
        await session.execute(
            delete(UserCard).where(UserCard.user_id == ids["user_id"])
        )
        await session.execute(
            delete(FlashCard).where(
                FlashCard.pool_id.in_(
                    [ids["pool_single_id"], ids["pool_concurrent_id"]]
                )
            )
        )
        await session.execute(
            delete(CardPool).where(
                CardPool.id.in_([ids["pool_single_id"], ids["pool_concurrent_id"]])
            )
        )
        await session.execute(
            delete(Lemma).where(
                Lemma.id.in_([ids["lemma_single_id"], ids["lemma_concurrent_id"]])
            )
        )
        await session.execute(
            delete(UserSettings).where(UserSettings.user_id == ids["user_id"])
        )
        await session.execute(delete(User).where(User.id == ids["user_id"]))
        await session.commit()
    finally:
        await session.close()


@pytest.mark.anyio
async def test_review_card_given_concurrent_same_card_expect_serialized_transitions(
    setup_database: None,
) -> None:
    """Concurrent submissions serialize and only the active issuance resolves."""
    ids = await _seed_committed_review_fixture()
    try:
        single_state = await _single_review_state(ids)
        results, loaded_stale_state = await _concurrent_review_results(ids)
        concurrent_card, log_count = await _concurrent_review_outcome(
            ids["uc_concurrent_id"]
        )
        assert not loaded_stale_state, (
            "second review loaded stale state while the first held the row lock"
        )
        assert len(results) == EXPECTED_CONCURRENT_REVIEW_COUNT
        assert sum(result is not None for result in results) == 1
        assert log_count == 1

        assert concurrent_card is not None
        assert concurrent_card.state == single_state
    finally:
        await _cleanup_committed_review_fixture(ids)


@pytest.mark.anyio
async def test_review_card_given_sequential_ratings_expect_ordered_transitions_and_two_logs(
    async_session: AsyncSession,
) -> None:
    """Two sequential valid ratings advance the FSRS state from one another and
    append two distinct review logs (R-002 characterization)."""
    from fsrs import Rating

    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user)
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    uc = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)

    svc = review_service(async_session)
    due = await svc.issue_due_cards(user.id)
    assert due[0].card.id == variant.id

    first = await svc.review_card(
        user_id=user.id, user_card_id=uc.id, rating=Rating.Good, card_id=due[0].card.id
    )
    first_state = first.state
    first_step = first.fsrs_step
    assert first.fsrs_stability is not None

    uc.due_at = datetime.now(UTC).replace(tzinfo=None)
    second_due = await svc.issue_due_cards(user.id)
    second = await svc.review_card(
        user_id=user.id,
        user_card_id=uc.id,
        rating=Rating.Good,
        card_id=second_due[0].card.id,
    )
    second_state = second.state
    second_step = second.fsrs_step

    # The second transition consumed the first's state: a NEW card given Good
    # transitions to Learning(step=1), then a second Good graduates it to
    # Review(step=None). The state and step change proves ordered advancement.
    assert first_state == CardState.LEARNING
    assert first_step == 1
    assert second_state == CardState.REVIEW
    assert second_step is None

    log_count = await async_session.scalar(
        select(func.count(StatsReviewLog.id)).where(
            StatsReviewLog.user_card_id == uc.id
        )
    )
    assert log_count == EXPECTED_REVIEW_LOG_COUNT


async def _single_review_state(ids: dict[str, int]) -> CardState:
    from fsrs import Rating

    session = _independent_session()
    try:
        service = review_service(session)
        result = await service.review_card(
            user_id=ids["user_id"],
            user_card_id=ids["uc_single_id"],
            rating=Rating.Good,
            card_id=ids["variant_single_id"],
        )
        await session.commit()
        assert result.fsrs_stability is not None
        return result.state
    finally:
        await session.close()


async def _review_and_commit(
    *,
    user_id: int,
    user_card_id: int,
    card_id: int,
    rating: int,
    loaded: asyncio.Event,
    release_load: asyncio.Event | None = None,
) -> UserCard | None:
    session = _independent_session(review_loaded=loaded, release_review=release_load)
    try:
        service = review_service(session)
        try:
            result = await service.review_card(
                user_id=user_id,
                user_card_id=user_card_id,
                rating=rating,
                card_id=card_id,
            )
        except CardNotFoundError:
            return None
        await session.commit()
        return result
    finally:
        await session.close()


async def _concurrent_review_results(
    ids: dict[str, int],
) -> tuple[list[UserCard | None], bool]:
    from fsrs import Rating

    first_review_loaded = asyncio.Event()
    release_first_review = asyncio.Event()
    second_review_loaded = asyncio.Event()
    review_args = {
        "user_id": ids["user_id"],
        "user_card_id": ids["uc_concurrent_id"],
        "card_id": ids["variant_concurrent_id"],
    }
    first_task = asyncio.create_task(
        _review_and_commit(
            user_id=review_args["user_id"],
            user_card_id=review_args["user_card_id"],
            card_id=review_args["card_id"],
            rating=Rating.Good,
            loaded=first_review_loaded,
            release_load=release_first_review,
        )
    )
    await asyncio.wait_for(first_review_loaded.wait(), timeout=2)

    second_task = asyncio.create_task(
        _review_and_commit(
            user_id=review_args["user_id"],
            user_card_id=review_args["user_card_id"],
            card_id=review_args["card_id"],
            rating=Rating.Good,
            loaded=second_review_loaded,
        )
    )
    loaded_stale_state = False
    try:
        await asyncio.wait_for(second_review_loaded.wait(), timeout=0.25)
    except TimeoutError:
        pass
    else:
        loaded_stale_state = True
    finally:
        release_first_review.set()

    results = await asyncio.wait_for(asyncio.gather(first_task, second_task), timeout=4)
    return list(results), loaded_stale_state


async def _concurrent_review_outcome(
    user_card_id: int,
) -> tuple[UserCard | None, int | None]:
    session = _independent_session()
    try:
        card = await session.scalar(select(UserCard).where(UserCard.id == user_card_id))
        log_count = await session.scalar(
            select(func.count(StatsReviewLog.id)).where(
                StatsReviewLog.user_card_id == user_card_id
            )
        )
        return card, log_count
    finally:
        await session.close()


async def _make_search_vocab_card(
    user: User,
    *,
    word: str,
    translation: str,
    forms: list[str] | None = None,
    stability: float = 5.0,
) -> UserCard:
    lemma = await LemmaFactory.create(word=word, primary_translation=translation)
    for form in forms or []:
        await WordFormFactory.create(lemma=lemma, form=form)
    pool = await CardPoolFactory.create(lemma=lemma)
    return await UserCardFactory.create(
        user=user, pool=pool, state=CardState.REVIEW, fsrs_stability=stability
    )


async def _make_search_grammar_card(
    user: User,
    *,
    title: str,
    pool_key: str,
    description: str | None = None,
    stability: float = 5.0,
) -> UserCard:
    lesson = await LessonFactory.create(title=title)
    pool = await CardPoolFactory.create(
        lesson=lesson, description=description, key=pool_key
    )
    return await UserCardFactory.create(
        user=user, pool=pool, state=CardState.REVIEW, fsrs_stability=stability
    )
