"""Unit tests for the My Cards gallery read-side (GET /me/cards service).

Covers:
- mastery-bucket derivation across each state/stability boundary
- facet split (vocab vs grammar)
- q search across lemma word + word forms + primary_translation + lesson title
- summary counts independent of started_only/pagination
"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.user_cards_service import MyCardsService
from flyt.apps.flashcards.user_cards_service import derive_mastery_bucket
from tests.factories import CardPoolFactory
from tests.factories import LemmaFactory
from tests.factories import LessonFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import WordFormFactory
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

EXPECTED_TOTAL_CARD_COUNT = 5
EXPECTED_STARTED_TOTAL = 2
EXPECTED_ALL_CARD_COUNT = 2
EXPECTED_PAGE_SIZE = 2
EXPECTED_SEARCH_CARD_COUNT = 2


def my_cards_service(session: AsyncSession) -> MyCardsService:
    return MyCardsService(session)


# --- derive_mastery_bucket boundary tests ---


@pytest.mark.parametrize(
    ("state", "stability", "expected"),
    [
        (CardState.NEW, None, "not_started"),
        (CardState.NEW, 999.0, "not_started"),
        (CardState.LEARNING, None, "learning"),
        (CardState.LEARNING, 5.0, "learning"),
        (CardState.RELEARNING, None, "learning"),
        (CardState.RELEARNING, 5.0, "learning"),
        (CardState.REVIEW, None, "familiar"),
        (CardState.REVIEW, 0.0, "familiar"),
        (CardState.REVIEW, 29.0, "familiar"),
        (CardState.REVIEW, 30.0, "known"),
        (CardState.REVIEW, 119.0, "known"),
        (CardState.REVIEW, 120.0, "mastered"),
        (CardState.REVIEW, 500.0, "mastered"),
    ],
)
def test_derive_mastery_bucket_at_boundaries(
    state: CardState, stability: float | None, expected: str
) -> None:
    assert derive_mastery_bucket(state, stability) == expected


# --- Service-level tests ---


@pytest.mark.anyio
async def test_list_user_cards_buckets_across_states_and_stabilities(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(user, state=CardState.NEW, stability=None)
    await _make_vocab_card(user, state=CardState.LEARNING, stability=1.0)
    await _make_vocab_card(user, state=CardState.REVIEW, stability=29.0)
    await _make_vocab_card(user, state=CardState.REVIEW, stability=30.0)
    await _make_vocab_card(user, state=CardState.REVIEW, stability=120.0)

    result = await my_cards_service(async_session).list_user_cards(
        user.id, started_only=False, limit=50
    )

    assert result.counts_by_bucket == {
        "not_started": 1,
        "learning": 1,
        "familiar": 1,
        "known": 1,
        "mastered": 1,
    }
    assert result.total == EXPECTED_TOTAL_CARD_COUNT


@pytest.mark.anyio
async def test_list_user_cards_summary_independent_of_started_only(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(user, state=CardState.NEW, stability=None)
    await _make_vocab_card(user, state=CardState.REVIEW, stability=200.0)

    service = my_cards_service(async_session)
    started = await service.list_user_cards(user.id, started_only=True)
    all_cards = await service.list_user_cards(user.id, started_only=False)

    assert len(started.cards) == 1
    assert started.cards[0].bucket == "mastered"
    assert started.counts_by_bucket["not_started"] == 1
    assert started.counts_by_bucket["mastered"] == 1
    assert started.total == EXPECTED_STARTED_TOTAL

    assert len(all_cards.cards) == EXPECTED_ALL_CARD_COUNT
    assert all_cards.counts_by_bucket == started.counts_by_bucket


@pytest.mark.anyio
async def test_list_user_cards_given_mixed_facets_expect_vocab_and_grammar_split(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma, _, _ = await _make_vocab_card(
        user, word="katt", primary_translation="cat", stability=10.0
    )
    lesson, _, _ = await _make_grammar_card(user, title="Genitive", stability=10.0)

    service = my_cards_service(async_session)

    all_result = await service.list_user_cards(user.id, facet="all")
    vocab_result = await service.list_user_cards(user.id, facet="vocab")
    grammar_result = await service.list_user_cards(user.id, facet="grammar")

    assert {c.facet for c in all_result.cards} == {"vocab", "grammar"}
    assert all(c.facet == "vocab" for c in vocab_result.cards)
    assert vocab_result.cards[0].lemma_uuid == lemma.uuid
    assert vocab_result.cards[0].lesson_id is None
    assert all(c.facet == "grammar" for c in grammar_result.cards)
    assert grammar_result.cards[0].lesson_id == lesson.id
    assert grammar_result.cards[0].lemma_uuid is None


@pytest.mark.anyio
async def test_list_user_cards_vocab_label_and_subtitle(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(
        user,
        word="bok",
        primary_translation="book / tome / volume",
        stability=200.0,
    )

    result = await my_cards_service(async_session).list_user_cards(user.id)

    assert len(result.cards) == 1
    card = result.cards[0]
    assert card.label == "bok"
    assert card.subtitle == "book"
    assert card.bucket == "mastered"


@pytest.mark.anyio
async def test_list_user_cards_grammar_label_uses_description_when_present(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_grammar_card(
        user,
        title="Lesson title",
        description="Pool concept title",
        stability=200.0,
    )

    result = await my_cards_service(async_session).list_user_cards(user.id)

    assert result.cards[0].label == "Pool concept title"


@pytest.mark.anyio
@pytest.mark.anyio
async def test_list_user_cards_search_across_word_forms(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(
        user,
        word="gå",
        primary_translation="go",
        forms=["gikk", "gått"],
        stability=10.0,
    )
    await _make_vocab_card(
        user,
        word="spise",
        primary_translation="eat",
        stability=10.0,
    )

    result = await my_cards_service(async_session).list_user_cards(user.id, q="gikk")

    assert len(result.cards) == 1
    assert result.cards[0].label == "gå"


@pytest.mark.anyio
async def test_list_user_cards_search_across_primary_translation(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(
        user,
        word="hus",
        primary_translation="house",
        stability=10.0,
    )

    result = await my_cards_service(async_session).list_user_cards(user.id, q="house")

    assert len(result.cards) == 1
    assert result.cards[0].label == "hus"


@pytest.mark.anyio
async def test_list_user_cards_given_grammar_title_query_expect_matching_card(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    _, pool, _ = await _make_grammar_card(user, title="Past Tense", stability=10.0)
    pool.key = "past_tense"
    await async_session.flush()
    await _make_grammar_card(user, title="Genitive", stability=10.0)

    result = await my_cards_service(async_session).list_user_cards(user.id, q="past")

    assert len(result.cards) == 1
    assert result.cards[0].label == "Past tense"


@pytest.mark.anyio
async def test_list_user_cards_given_weakest_sort_expect_ascending_stability(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(user, word="strong", stability=100.0)
    await _make_vocab_card(user, word="weak", stability=1.0)
    await _make_vocab_card(user, word="mid", stability=50.0)

    result = await my_cards_service(async_session).list_user_cards(
        user.id, sort="weakest"
    )

    labels = [c.label for c in result.cards]
    assert labels == ["weak", "mid", "strong"]


@pytest.mark.anyio
async def test_list_user_cards_given_alpha_sort_expect_alphabetical_labels(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(user, word="zebra", stability=1.0)
    await _make_vocab_card(user, word="apple", stability=100.0)

    result = await my_cards_service(async_session).list_user_cards(
        user.id, sort="alpha"
    )

    labels = [c.label for c in result.cards]
    assert labels == ["apple", "zebra"]


@pytest.mark.anyio
async def test_list_user_cards_sort_recent_newest_review_first(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(
        user,
        word="old",
        stability=1.0,
        last_review_at=datetime(2024, 1, 1, 12, 0, 0),
    )
    await _make_vocab_card(user, word="never", stability=1.0)
    await _make_vocab_card(
        user,
        word="new",
        stability=1.0,
        last_review_at=datetime(2024, 2, 1, 12, 0, 0),
    )

    result = await my_cards_service(async_session).list_user_cards(
        user.id, sort="recent"
    )

    labels = [c.label for c in result.cards]
    assert labels == ["new", "old", "never"]


@pytest.mark.anyio
async def test_list_user_cards_pagination(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    for i in range(5):
        await _make_vocab_card(user, word=f"word{i}", stability=float(i + 1))

    service = my_cards_service(async_session)

    page1 = await service.list_user_cards(user.id, page=1, limit=2)
    page2 = await service.list_user_cards(user.id, page=2, limit=2)
    page3 = await service.list_user_cards(user.id, page=3, limit=2)

    assert len(page1.cards) == EXPECTED_PAGE_SIZE
    assert page1.has_more is True
    assert len(page2.cards) == EXPECTED_PAGE_SIZE
    assert page2.has_more is True
    assert len(page3.cards) == 1
    assert page3.has_more is False


@pytest.mark.anyio
async def test_list_user_cards_bucket_filter(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await _make_vocab_card(user, word="fam", stability=10.0)
    await _make_vocab_card(user, word="known", stability=50.0)

    result = await my_cards_service(async_session).list_user_cards(
        user.id, bucket="known"
    )

    assert len(result.cards) == 1
    assert result.cards[0].bucket == "known"


@pytest.mark.anyio
async def test_list_user_cards_empty_for_brand_new_user(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    result = await my_cards_service(async_session).list_user_cards(user.id)

    assert result.cards == []
    assert result.total == 0
    assert result.counts_by_bucket == {
        "not_started": 0,
        "learning": 0,
        "familiar": 0,
        "known": 0,
        "mastered": 0,
    }


@pytest.mark.anyio
async def test_list_user_cards_given_word_form_query_expect_no_standalone_load(
    async_session: AsyncSession,
) -> None:
    """Word forms belong to the SQL search predicate, never a page eager load."""
    user = await UserFactory.create()
    await _make_vocab_card(
        user,
        word="gå",
        primary_translation="go",
        forms=["gikk", "gått"],
        stability=10.0,
    )
    await _make_vocab_card(user, word="spise", primary_translation="eat", stability=9.0)

    service = my_cards_service(async_session)
    with capture_sql(async_session) as executed:
        unfiltered = await service.list_user_cards(user.id, limit=50)
        matched = await service.list_user_cards(user.id, q="gikk", limit=50)

    assert len(unfiltered.cards) == EXPECTED_SEARCH_CARD_COUNT
    assert [c.label for c in matched.cards] == ["gå"]
    word_form_reads = statements_reading(executed, "lexicon_word_forms")
    assert word_form_reads, "word-form search predicate missing"
    # Any word-form read is the in-SQL search inside the page query, not a
    # standalone eager load of the relationship.
    assert all("EXISTS" in statement for statement, _parameters in word_form_reads)


async def _make_vocab_card(
    user,
    word: str = "hund",
    primary_translation: str | None = "dog / hound",
    state: CardState = CardState.REVIEW,
    stability: float | None = 5.0,
    forms: list[str] | None = None,
    last_review_at: datetime | None = None,
):
    lemma = await LemmaFactory.create(
        word=word, primary_translation=primary_translation
    )
    for form in forms or []:
        await WordFormFactory.create(lemma=lemma, form=form)
    pool = await CardPoolFactory.create(lemma=lemma)
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=state,
        fsrs_stability=stability,
        last_review_at=last_review_at,
    )
    return lemma, pool, user_card


async def _make_grammar_card(
    user,
    title: str = "Past tense",
    description: str | None = None,
    state: CardState = CardState.REVIEW,
    stability: float | None = 5.0,
):
    lesson = await LessonFactory.create(title=title)
    pool = await CardPoolFactory.create(lesson=lesson, description=description)
    user_card = await UserCardFactory.create(
        user=user, pool=pool, state=state, fsrs_stability=stability
    )
    return lesson, pool, user_card
