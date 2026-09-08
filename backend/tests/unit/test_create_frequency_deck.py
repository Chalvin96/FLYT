"""Tests for the frequency deck build (idempotency, correctness, re-sync).

The deck is built from Lemma rows that carry frequency_rank; no JSON path.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Deck
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.deck_service import FlashcardDeckService
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.users.services import UserLemmaService
from scripts.create_frequency_deck import DECK_NAME
from scripts.create_frequency_deck import create_frequency_deck
from tests.factories import DefinitionFactory
from tests.factories import LemmaFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio

MAX_SENSE_CUE_LENGTH = 42
EXPECTED_IMPORTED_ENTRY_COUNT = 2
EXPECTED_TAGGED_CARD_COUNT = 2
SECOND_LEMMA_FREQUENCY_RANK = 2
IDEMPOTENT_LEMMA_FREQUENCY_RANK = 3
SHARED_HOMOGRAPH_FREQUENCY_RANK = 10
EXPECTED_ENROLLED_CARD_COUNT = 3
OTHER_DECK_FREQUENCY_RANK = 99


def test_sense_cue_text_given_definitions_expect_truncated_first_norwegian() -> None:
    from types import SimpleNamespace

    from flyt.apps.flashcards.card_service import sense_cue_text

    d = lambda t: SimpleNamespace(definition=t)  # noqa: E731
    assert (
        sense_cue_text(SimpleNamespace(definitions=[d("liten sekk")])) == "liten sekk"
    )
    # Skips blank, takes the first non-empty.
    assert (
        sense_cue_text(SimpleNamespace(definitions=[d("  "), d("stilling")]))
        == "stilling"
    )
    # Truncates long text with an ellipsis.
    long = "x" * 60
    cue = sense_cue_text(SimpleNamespace(definitions=[d(long)]))
    assert cue is not None and cue.endswith("…") and len(cue) <= MAX_SENSE_CUE_LENGTH
    assert sense_cue_text(SimpleNamespace(definitions=[])) is None


def flashcard_service(session: AsyncSession) -> FlashcardCardService:
    return FlashcardCardService(session, UserLemmaService(session))


class _TestSessionContext:
    """Minimal async context manager wrapping a test AsyncSession."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *args):
        return False


async def _run_import(async_session: AsyncSession) -> dict[str, int]:
    from scripts import create_frequency_deck as mod

    original_local = mod.AsyncSessionLocal
    mod.AsyncSessionLocal = lambda: _TestSessionContext(async_session)
    try:
        return await create_frequency_deck()
    finally:
        mod.AsyncSessionLocal = original_local


async def _get_deck(async_session: AsyncSession) -> Deck:
    deck = await async_session.scalar(select(Deck).where(Deck.name == DECK_NAME))
    assert deck is not None
    return deck


async def _definition_card(async_session: AsyncSession, pool_id: int) -> FlashCard:
    card = await async_session.scalar(
        select(FlashCard)
        .where(FlashCard.pool_id == pool_id)
        .where(FlashCard.type == CardType.DEFINITION)
        .order_by(FlashCard.id.asc())
        .limit(1)
    )
    assert card is not None
    return card


async def test_import_given_no_word_pos_collision_expect_no_sense_cue(
    async_session: AsyncSession,
) -> None:
    """A lemma that does not share its (word, pos) gets no sense cue."""
    lemma = await LemmaFactory.create(
        word="fisk", pos=LemmaPos.NOUN, frequency_rank=1, primary_translation="fish"
    )
    await DefinitionFactory.create(lemma=lemma, definition="akvatisk dyr")

    await _run_import(async_session)

    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    card = await _definition_card(async_session, pool.id)
    assert card.payload_json["sense_cue"] is None


async def test_import_creates_deck_pools_and_tags_cards(
    async_session: AsyncSession,
) -> None:
    lemma_a = await LemmaFactory.create(frequency_rank=1, primary_translation="be")
    lemma_b = await LemmaFactory.create(frequency_rank=2, primary_translation="and")

    stats = await _run_import(async_session)

    assert stats["entries_processed"] == EXPECTED_IMPORTED_ENTRY_COUNT
    assert stats["cards_tagged"] == EXPECTED_TAGGED_CARD_COUNT

    deck = await _get_deck(async_session)
    assert deck.source == "Norwegian Kelly List (UiO Text Laboratory)"
    assert deck.license == "CC BY-SA 4.0"
    assert deck.cefr_range is None

    pool_a = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_a.id)
    )
    assert pool_a is not None
    assert pool_a.frequency_rank == 1

    pool_b = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_b.id)
    )
    assert pool_b is not None
    assert pool_b.frequency_rank == SECOND_LEMMA_FREQUENCY_RANK

    card_a = await _definition_card(async_session, pool_a.id)
    assert card_a.deck_id == deck.id


async def test_import_is_idempotent(async_session: AsyncSession) -> None:
    lemma = await LemmaFactory.create(frequency_rank=3, primary_translation="fish")

    await _run_import(async_session)
    await _run_import(async_session)

    deck_count = len(
        (await async_session.scalars(select(Deck).where(Deck.name == DECK_NAME))).all()
    )
    assert deck_count == 1

    pool_count = len(
        (
            await async_session.scalars(
                select(CardPool).where(CardPool.lemma_id == lemma.id)
            )
        ).all()
    )
    assert pool_count == 1

    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is not None
    assert pool.frequency_rank == IDEMPOTENT_LEMMA_FREQUENCY_RANK


async def test_import_skips_lemma_with_null_primary_translation(
    async_session: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(frequency_rank=4, primary_translation=None)

    stats = await _run_import(async_session)

    assert stats["entries_processed"] == 0
    assert stats["cards_tagged"] == 0

    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is None


async def test_import_skips_lemma_with_blank_primary_translation(
    async_session: AsyncSession,
) -> None:
    """Empty-string primary_translation is treated as no translation (skip)."""
    lemma = await LemmaFactory.create(frequency_rank=5, primary_translation="   ")

    stats = await _run_import(async_session)

    assert stats["entries_processed"] == 0
    assert stats["cards_tagged"] == 0

    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is None


async def test_import_skips_lemma_with_null_frequency_rank(
    async_session: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(frequency_rank=None, primary_translation="x")

    stats = await _run_import(async_session)

    assert stats["entries_processed"] == 0

    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is None


async def test_import_honors_rank_hgno_id_ordering(
    async_session: AsyncSession,
) -> None:
    """Pool creation order follows (frequency_rank, hgno, id)."""
    # Same rank, distinct hgno: lower hgno comes first.
    lemma_a = await LemmaFactory.create(
        word="ordre", hgno=2, frequency_rank=1, primary_translation="a"
    )
    lemma_b = await LemmaFactory.create(
        word="ordre", hgno=1, frequency_rank=1, primary_translation="b"
    )
    # Higher rank comes after.
    lemma_c = await LemmaFactory.create(
        word="senere", hgno=1, frequency_rank=2, primary_translation="c"
    )

    await _run_import(async_session)

    pools = (
        await async_session.scalars(
            select(CardPool)
            .where(CardPool.lemma_id.in_([lemma_a.id, lemma_b.id, lemma_c.id]))
            .order_by(CardPool.id)
        )
    ).all()

    # First created pool should belong to lemma_b (rank 1, hgno 1),
    # then lemma_a (rank 1, hgno 2), then lemma_c (rank 2).
    assert [p.lemma_id for p in pools] == [lemma_b.id, lemma_a.id, lemma_c.id]


async def test_import_includes_shared_rank_homographs_as_separate_cards(
    async_session: AsyncSession,
) -> None:
    """Option A: every ranked lemma becomes its own card, even at the same rank."""
    lemma_x = await LemmaFactory.create(
        word="bok", hgno=1, frequency_rank=10, primary_translation="book"
    )
    lemma_y = await LemmaFactory.create(
        word="bok", hgno=2, frequency_rank=10, primary_translation="book (sense 2)"
    )

    stats = await _run_import(async_session)

    assert stats["entries_processed"] == EXPECTED_IMPORTED_ENTRY_COUNT
    assert stats["cards_tagged"] == EXPECTED_TAGGED_CARD_COUNT

    deck = await _get_deck(async_session)

    pool_x = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_x.id)
    )
    pool_y = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_y.id)
    )
    assert pool_x is not None
    assert pool_y is not None
    assert pool_x.frequency_rank == SHARED_HOMOGRAPH_FREQUENCY_RANK
    assert pool_y.frequency_rank == SHARED_HOMOGRAPH_FREQUENCY_RANK

    card_x = await _definition_card(async_session, pool_x.id)
    card_y = await _definition_card(async_session, pool_y.id)
    assert card_x.deck_id == deck.id
    assert card_y.deck_id == deck.id


async def test_sync_sense_cues_given_preexisting_sibling_cards_expect_backfilled(
    async_session: AsyncSession,
) -> None:
    """A rebuild where both homograph cards already exist still populates cues."""
    svc = flashcard_service(async_session)
    lemma_a = await LemmaFactory.create(
        word="pose", pos=LemmaPos.NOUN, hgno=1, primary_translation="bag"
    )
    lemma_b = await LemmaFactory.create(
        word="pose", pos=LemmaPos.NOUN, hgno=2, primary_translation="stance"
    )
    await DefinitionFactory.create(lemma=lemma_a, definition="liten sekk")
    await DefinitionFactory.create(lemma=lemma_b, definition="stilling, holdning")

    pool_a = await svc.find_or_create_lemma_pool_with_definition_card(lemma_a)
    pool_b = await svc.find_or_create_lemma_pool_with_definition_card(lemma_b)
    # Second call finds the existing card — must still back-fill both cues.
    await svc.find_or_create_lemma_pool_with_definition_card(lemma_a)

    card_a = await _definition_card(async_session, pool_a.id)
    card_b = await _definition_card(async_session, pool_b.id)
    assert card_a.payload_json["sense_cue"] == "liten sekk"
    assert card_b.payload_json["sense_cue"] == "stilling, holdning"


async def test_sync_sense_cues_given_shared_definition_prefix_expect_full_fallback(
    async_session: AsyncSession,
) -> None:
    """When truncated cues collide (shared first ~41 chars), fall back to full text."""
    svc = flashcard_service(async_session)
    shared = "det å utføre en handling på en bestemt måte"  # > 42 chars
    a_def = shared + " for penger"
    b_def = shared + " uten grunn"
    lemma_a = await LemmaFactory.create(
        word="ta", pos=LemmaPos.VERB, hgno=1, primary_translation="a"
    )
    lemma_b = await LemmaFactory.create(
        word="ta", pos=LemmaPos.VERB, hgno=2, primary_translation="b"
    )
    await DefinitionFactory.create(lemma=lemma_a, definition=a_def)
    await DefinitionFactory.create(lemma=lemma_b, definition=b_def)

    pool_a = await svc.find_or_create_lemma_pool_with_definition_card(lemma_a)
    pool_b = await svc.find_or_create_lemma_pool_with_definition_card(lemma_b)

    card_a = await _definition_card(async_session, pool_a.id)
    card_b = await _definition_card(async_session, pool_b.id)
    # Truncations would both be "det å utføre …" — fall back to full, stay distinct.
    assert card_a.payload_json["sense_cue"] == a_def
    assert card_b.payload_json["sense_cue"] == b_def
    assert card_a.payload_json["sense_cue"] != card_b.payload_json["sense_cue"]


async def test_create_frequency_deck_given_shared_rank_homographs_expect_distinct_differentiable_cards(
    async_session: AsyncSession,
) -> None:
    """Every meaning of a shared-rank homograph becomes its own card, and the
    card payload carries enough to tell them apart (hgno + distinct senses)."""
    lemma_a = await LemmaFactory.create(
        word="være",
        pos=LemmaPos.VERB,
        hgno=1,
        frequency_rank=1,
        frequency_ambiguous=True,
        primary_translation="be",
    )
    lemma_b = await LemmaFactory.create(
        word="være",
        pos=LemmaPos.VERB,
        hgno=2,
        frequency_rank=1,
        frequency_ambiguous=True,
        primary_translation="be (dwell)",
    )
    await DefinitionFactory.create(
        lemma=lemma_a, definition="finnes; eksistere", translation="to exist"
    )
    await DefinitionFactory.create(
        lemma=lemma_b, definition="oppholde seg", translation="to stay / dwell"
    )

    stats = await _run_import(async_session)
    assert (
        stats["cards_tagged"] == EXPECTED_TAGGED_CARD_COUNT
    )  # every meaning becomes a flashcard

    deck = await _get_deck(async_session)
    pool_a = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_a.id)
    )
    pool_b = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma_b.id)
    )
    assert pool_a is not None and pool_b is not None
    assert pool_a.id != pool_b.id  # distinct pool per homograph

    card_a = await _definition_card(async_session, pool_a.id)
    card_b = await _definition_card(async_session, pool_b.id)
    assert card_a.id != card_b.id
    assert card_a.deck_id == deck.id and card_b.deck_id == deck.id

    # A learner tells them apart from the card payload: distinct hgno,
    # primary_translation, and definition senses.
    assert card_a.payload_json["hgno"] != card_b.payload_json["hgno"]
    # Because these two cards collide on (word, pos), the builder's sync fills each
    # with its own Norwegian sense cue (from its first definition).
    assert card_a.payload_json["sense_cue"] == "finnes; eksistere"
    assert card_b.payload_json["sense_cue"] == "oppholde seg"
    assert (
        card_a.payload_json["primary_translation"]
        != card_b.payload_json["primary_translation"]
    )
    senses_a = {d["translation"] for d in card_a.payload_json["definitions"]}
    senses_b = {d["translation"] for d in card_b.payload_json["definitions"]}
    assert senses_a == {"to exist"}
    assert senses_b == {"to stay / dwell"}
    assert senses_a.isdisjoint(senses_b)


async def test_subscribe_to_deck_given_homographs_expect_each_meaning_enrolled_separately(
    async_session: AsyncSession,
) -> None:
    """Subscribing to the deck enrolls each homograph as its own UPCOMING card;
    shared spelling/rank does not collapse or drop a meaning."""
    lemma_a = await LemmaFactory.create(
        word="bønner",
        pos=LemmaPos.NOUN,
        hgno=1,
        frequency_rank=42,
        frequency_ambiguous=True,
        primary_translation="beans",
    )
    lemma_b = await LemmaFactory.create(
        word="bønner",
        pos=LemmaPos.NOUN,
        hgno=2,
        frequency_rank=42,
        frequency_ambiguous=True,
        primary_translation="prayers",
    )
    lemma_solo = await LemmaFactory.create(
        word="hus",
        pos=LemmaPos.NOUN,
        hgno=1,
        frequency_rank=7,
        primary_translation="house",
    )

    await _run_import(async_session)
    deck = await _get_deck(async_session)

    pool_ids = {
        lemma.id: (
            await async_session.scalar(
                select(CardPool.id).where(CardPool.lemma_id == lemma.id)
            )
        )
        for lemma in (lemma_a, lemma_b, lemma_solo)
    }

    user = await UserFactory.create()
    await FlashcardDeckService(async_session).subscribe_to_deck(
        user_id=user.id, deck_id=deck.id
    )

    user_cards = (
        await async_session.scalars(select(UserCard).where(UserCard.user_id == user.id))
    ).all()

    # Both homographs + the solo lemma each enroll once — no collision, none dropped.
    assert len(user_cards) == EXPECTED_ENROLLED_CARD_COUNT
    assert {uc.pool_id for uc in user_cards} == set(pool_ids.values())
    assert all(uc.enrollment_state == Enrollment.UPCOMING for uc in user_cards)


async def test_import_resync_clears_pool_when_lemma_loses_rank(
    async_session: AsyncSession,
) -> None:
    """A lemma that was ranked and is no longer ranked gets its pool rank + card deck_id cleared."""
    # First build: lemma has a rank and is tagged to the deck.
    lemma = await LemmaFactory.create(frequency_rank=1, primary_translation="word")

    await _run_import(async_session)

    deck = await _get_deck(async_session)
    pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is not None
    assert pool.frequency_rank == 1
    card = await _definition_card(async_session, pool.id)
    assert card.deck_id == deck.id

    # Lemma loses its rank on a rebuild (rank dropped upstream).
    lemma.frequency_rank = None
    await async_session.flush()

    await _run_import(async_session)

    refreshed_pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert refreshed_pool is not None
    assert refreshed_pool.frequency_rank is None

    refreshed_card = await _definition_card(async_session, refreshed_pool.id)
    assert refreshed_card.deck_id is None


async def test_import_resync_is_scoped_to_this_deck_only(
    async_session: AsyncSession,
) -> None:
    """Re-sync must NOT untag cards whose deck_id points at a different deck."""
    from tests.factories import CardPoolFactory
    from tests.factories import DeckFactory
    from tests.factories import FlashCardFactory

    # A lemma that is NOT ranked but whose pool/card were previously tagged to
    # an unrelated deck. The re-sync (scoped to DECK_NAME) must leave it alone.
    unranked_lemma = await LemmaFactory.create(
        frequency_rank=None, primary_translation="x"
    )
    other_deck = await DeckFactory.create(name="Other Deck")
    other_pool = await CardPoolFactory.create(lemma=unranked_lemma, frequency_rank=99)
    other_card = await FlashCardFactory.create(
        pool=other_pool, deck=other_deck, type=CardType.DEFINITION
    )

    # Build the real deck from a different ranked lemma.
    ranked_lemma = await LemmaFactory.create(
        frequency_rank=1, primary_translation="ranked"
    )

    stats = await _run_import(async_session)
    assert stats["entries_processed"] == 1  # only the ranked lemma

    # The ranked lemma gets a pool tagged to DECK_NAME.
    ranked_pool = await async_session.scalar(
        select(CardPool).where(CardPool.lemma_id == ranked_lemma.id)
    )
    assert ranked_pool is not None
    assert ranked_pool.frequency_rank == 1

    # The unranked lemma's pre-existing card on Other Deck is untouched.
    refreshed = await async_session.get(FlashCard, other_card.id)
    assert refreshed.deck_id == other_deck.id

    refreshed_pool = await async_session.get(CardPool, other_pool.id)
    # other_pool.frequency_rank is left untouched: it belongs to a different deck
    # and re-sync only clears pools tagged to DECK_NAME's deck.
    assert refreshed_pool.frequency_rank == OTHER_DECK_FREQUENCY_RANK


async def test_import_resync_when_no_ranked_lemmas_clears_all_tags(
    async_session: AsyncSession,
) -> None:
    """An empty ranked set should drop every stale tag off this deck."""
    from tests.factories import CardPoolFactory
    from tests.factories import FlashCardFactory

    # Seed a previously-tagged deck state without going through the build
    # (no ranked lemmas exist to build from).
    deck = await DeckFactory_with_name(async_session, DECK_NAME)
    lemma = await LemmaFactory.create(primary_translation="x")  # rank stays NULL
    pool = await CardPoolFactory.create(lemma=lemma, frequency_rank=42)
    card = await FlashCardFactory.create(pool=pool, deck=deck, type=CardType.DEFINITION)

    await _run_import(async_session)

    refreshed_pool = await async_session.get(CardPool, pool.id)
    assert refreshed_pool.frequency_rank is None
    refreshed_card = await async_session.get(FlashCard, card.id)
    assert refreshed_card.deck_id is None


async def test_import_no_ranked_lemmas_is_noop_on_empty_db(
    async_session: AsyncSession,
) -> None:
    stats = await _run_import(async_session)

    assert stats["entries_processed"] == 0
    assert stats["cards_tagged"] == 0
    # Deck row is still created (find-or-create).
    deck = await _get_deck(async_session)
    assert deck.name == DECK_NAME


# ── helpers ──────────────────────────────────────────────────────────────────


async def DeckFactory_with_name(async_session: AsyncSession, name: str) -> Deck:
    from tests.factories import DeckFactory

    return await DeckFactory.create(name=name)
