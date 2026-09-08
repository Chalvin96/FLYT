import pytest

from flyt.apps.flashcards.models import Enrollment
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import VocabularyStatus
from flyt.apps.story_generation.vocabulary import derive_target_count
from flyt.apps.story_generation.vocabulary import has_unknown_targets
from flyt.core.config import settings
from tests.factories import CardPoolFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory

EXPECTED_PROMPT_VOCABULARY_BOUND = 50
EXPECTED_KNOWN_LEMMA_COUNT = 200
EXPECTED_DECK_BASE_WORD_COUNT = 2
MIN_DERIVED_TARGET_COUNT = 2
MAX_DERIVED_TARGET_COUNT = 4

pytestmark = pytest.mark.anyio


async def test_vocabulary_service_classifier_given_db_state_expect_correct_classification(
    db,
) -> None:
    """R-010: mastered, in-progress, and unknown lemmas are decided by one rule
    applied to the learner's stored state."""
    user = await UserFactory.create_async()
    mastered_lemma = await LemmaFactory.create(word="hus", frequency_rank=1)
    learning_lemma = await LemmaFactory.create(word="bil", frequency_rank=2)
    unknown_lemma = await LemmaFactory.create(word="fly", frequency_rank=3)

    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=mastered_lemma.id, is_mastered=True
    )
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=learning_lemma.id, is_mastered=False
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    classifier = await VocabularyService(db).build_classifier(user.id)

    assert classifier.classify(mastered_lemma.id) is VocabularyStatus.KNOWN
    assert classifier.classify(learning_lemma.id) is VocabularyStatus.IN_PROGRESS
    assert classifier.classify(unknown_lemma.id) is VocabularyStatus.UNKNOWN


async def test_classifier_given_mixed_enrollment_states_expect_only_active_in_progress(
    db,
) -> None:
    user = await UserFactory.create_async()
    active_lemma = await LemmaFactory.create(word="hus", frequency_rank=1)
    upcoming_lemma = await LemmaFactory.create(word="bil", frequency_rank=2)
    active_pool = await CardPoolFactory.create(lemma=active_lemma)
    upcoming_pool = await CardPoolFactory.create(lemma=upcoming_lemma)
    await UserCardFactory.create_async(
        user_id=user.id, pool=active_pool, enrollment_state=Enrollment.ACTIVE
    )
    await UserCardFactory.create_async(
        user_id=user.id, pool=upcoming_pool, enrollment_state=Enrollment.UPCOMING
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    classifier = await VocabularyService(db).build_classifier(user.id)

    assert classifier.classify(active_lemma.id) is VocabularyStatus.IN_PROGRESS
    assert classifier.classify(upcoming_lemma.id) is VocabularyStatus.UNKNOWN


async def test_anchor_choices_given_deck_below_minimum_expect_unavailable_with_reason(
    db,
) -> None:
    """R-002: the deck anchor below the minimum size is offered unavailable with
    its reason stated."""
    user = await UserFactory.create_async()
    for _ in range(5):
        lemma = await LemmaFactory.create()
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    choices = await VocabularyService(db).anchor_choices(user.id)

    deck_choice = next(c for c in choices.choices if c.type is AnchorType.DECK)
    assert deck_choice.available is False
    assert deck_choice.reason is not None


async def test_anchor_choices_given_deck_above_minimum_expect_available(db) -> None:
    """R-002: a deck meeting the minimum size anchors generation."""
    user = await UserFactory.create_async()
    min_size = settings.STORY_GENERATION_MIN_DECK_SIZE
    for _ in range(min_size):
        lemma = await LemmaFactory.create()
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    choices = await VocabularyService(db).anchor_choices(user.id)

    deck_choice = next(c for c in choices.choices if c.type is AnchorType.DECK)
    assert deck_choice.available is True
    assert deck_choice.reason is None


async def test_anchor_choices_given_deck_equals_frequency_deck_expect_collapses(
    db,
) -> None:
    """R-002: a deck that is the shared frequency deck is not offered as a
    separate choice."""
    user = await UserFactory.create_async()
    lemmas = []
    for rank in range(1, 101):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        lemmas.append(lemma)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    choices = await VocabularyService(db).anchor_choices(user.id)

    assert choices.deck_collapses_with_frequency is True


async def test_anchor_choices_given_deck_differs_from_frequency_expect_no_collapse(
    db,
) -> None:
    """R-002: a deck with lemmas outside the frequency deck stays a separate
    choice."""
    user = await UserFactory.create_async()
    freq_lemmas = []
    for rank in range(1, 6):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        freq_lemmas.append(lemma)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    extra = await LemmaFactory.create(frequency_rank=None)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=extra.id, is_mastered=True
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    choices = await VocabularyService(db).anchor_choices(user.id)

    assert choices.deck_collapses_with_frequency is False


async def test_vocabulary_select_given_frequency_anchor_expect_base_from_frequency(
    db,
) -> None:
    """R-002: the frequency anchor draws the comprehensible base from that band,
    and R-010: targets are drawn from what the learner does not know."""
    user = await UserFactory.create_async()
    known_freq = await LemmaFactory.create(word="hus", frequency_rank=1)
    known_non_freq = await LemmaFactory.create(word="tak", frequency_rank=None)
    await LemmaFactory.create(word="skog", frequency_rank=2)

    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known_freq.id, is_mastered=True
    )
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known_non_freq.id, is_mastered=True
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(
        user.id, AnchorType.FREQUENCY, length=250
    )

    assert "hus" in selection.base_words
    assert "tak" not in selection.base_words
    assert "skog" in selection.target_words


async def test_vocabulary_select_given_none_anchor_expect_no_base_but_targets_present(
    db,
) -> None:
    """R-002: no anchor sends no comprehensible base, and R-010: target words
    are still selected beyond the learner's knowledge."""
    user = await UserFactory.create_async()
    known = await LemmaFactory.create(word="hus", frequency_rank=1)
    await LemmaFactory.create(word="skog", frequency_rank=2)

    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(user.id, AnchorType.NONE, length=250)

    assert selection.base_words == []
    assert len(selection.target_words) > 0


async def test_vocabulary_select_given_all_known_expect_no_targets(db) -> None:
    """R-010: an anchor with nothing left to teach yields no targets, so the
    learner is refused instead of reading an all-known story."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(
        user.id, AnchorType.FREQUENCY, length=250
    )

    assert len(selection.target_lemma_ids) == 0
    assert has_unknown_targets(selection) is False


async def test_vocabulary_select_given_entire_frequency_deck_known_expect_targets_beyond_deck(
    db,
) -> None:
    """R-010: targets are drawn beyond the learner's vocabulary, unscoped — a
    learner who knows every ranked lemma still gets unlearned lemmas from the
    rest of the table instead of a refusal."""
    user = await UserFactory.create_async()
    for rank in range(1, 6):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    extra = await LemmaFactory.create(word="nautilus", frequency_rank=None)
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(
        user.id, AnchorType.FREQUENCY, length=250
    )

    assert selection.target_lemma_ids == [extra.id]
    assert selection.target_words == ["nautilus"]
    assert has_unknown_targets(selection) is True


async def test_vocabulary_select_given_mixed_unknown_lemmas_expect_ranked_first(
    db,
) -> None:
    """R-010: among unknown lemmas, common (ranked) words are selected before
    unranked ones."""
    user = await UserFactory.create_async()
    known = await LemmaFactory.create(word="hus", frequency_rank=1)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=known.id, is_mastered=True
    )
    unranked = await LemmaFactory.create(word="eple", frequency_rank=None)
    ranked = await LemmaFactory.create(word="skog", frequency_rank=2)
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(user.id, AnchorType.NONE, length=250)

    assert selection.target_lemma_ids == [ranked.id, unranked.id]


async def test_vocabulary_select_given_large_vocabulary_expect_base_bounded(
    db, monkeypatch
) -> None:
    """R-011: the prompt vocabulary is bounded and does not grow with the
    learner's known-word count, while the full vocabulary still measures."""
    user = await UserFactory.create_async()
    monkeypatch.setattr(settings, "STORY_GENERATION_PROMPT_VOCABULARY_BOUND", 50)

    from flyt.apps.story_generation.vocabulary import VocabularyService

    for rank in range(1, 201):
        lemma = await LemmaFactory.create(frequency_rank=rank)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await LemmaFactory.create(word="fjell", frequency_rank=201)
    await db.flush()

    selection = await VocabularyService(db).select(
        user.id, AnchorType.FREQUENCY, length=250
    )

    assert len(selection.base_words) <= EXPECTED_PROMPT_VOCABULARY_BOUND
    assert selection.base_truncated is True
    assert len(selection.classifier.known_ids) == EXPECTED_KNOWN_LEMMA_COUNT


async def test_vocabulary_select_given_deck_with_non_frequency_lemmas_expect_deck_words_sent(
    db,
) -> None:
    """R-002: a deck holding lemmas absent from the frequency deck still sends
    those words to the model as words — never as bare ids."""
    user = await UserFactory.create_async()
    freq_known = await LemmaFactory.create(word="hus", frequency_rank=1)
    await LemmaFactory.create(word="skog", frequency_rank=2)
    deck_extra = await LemmaFactory.create(word="giraff", frequency_rank=None)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=freq_known.id, is_mastered=True
    )
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=deck_extra.id, is_mastered=True
    )
    await db.flush()

    from flyt.apps.story_generation.vocabulary import VocabularyService

    selection = await VocabularyService(db).select(user.id, AnchorType.DECK, length=250)

    assert "giraff" in selection.base_words
    assert "hus" in selection.base_words
    assert all(word.isalpha() for word in selection.base_words)


async def test_vocabulary_select_given_deck_over_bound_expect_sampled_words_still_words(
    db, monkeypatch
) -> None:
    """R-002/R-011: when the deck base is truncated to the prompt-vocabulary
    bound, every sampled word is still the lemma's word, including lemmas
    outside the frequency deck."""
    user = await UserFactory.create_async()
    monkeypatch.setattr(settings, "STORY_GENERATION_PROMPT_VOCABULARY_BOUND", 2)

    from flyt.apps.story_generation.vocabulary import VocabularyService

    freq_known = await LemmaFactory.create(word="hus", frequency_rank=1)
    await UserLemmaFactory.create_async(
        user_id=user.id, lemma_id=freq_known.id, is_mastered=True
    )
    extra_words = [
        "elev",
        "bamse",
        "katt",
        "hund",
        "mus",
        "fisk",
        "tre",
        "vann",
        "sjel",
        "stein",
    ]
    for word in extra_words:
        lemma = await LemmaFactory.create(word=word, frequency_rank=None)
        await UserLemmaFactory.create_async(
            user_id=user.id, lemma_id=lemma.id, is_mastered=True
        )
    await db.flush()

    selection = await VocabularyService(db).select(user.id, AnchorType.DECK, length=250)

    assert selection.base_truncated is True
    assert len(selection.base_words) == EXPECTED_DECK_BASE_WORD_COUNT
    assert selection.base_words[0] == "hus"
    assert all(word.isalpha() for word in selection.base_words)


def test_derive_target_count_given_longer_length_expect_more_targets() -> None:
    """R-010: the target count is derived from the story's length, not a fixed
    quantity."""
    assert derive_target_count(400) >= derive_target_count(250)
    assert derive_target_count(250) >= derive_target_count(150)


def test_derive_target_count_given_extreme_length_expect_clamped() -> None:
    """R-010: the derived target count stays within the bounded set."""
    assert derive_target_count(10000) == MAX_DERIVED_TARGET_COUNT
    assert derive_target_count(10) == MIN_DERIVED_TARGET_COUNT
