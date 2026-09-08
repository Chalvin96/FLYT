"""Unit tests for story-generation quality measurement.

``measure`` stays pure: it is fed pages, a classifier, a uuid-to-id map, and the
requested target lemma ids, and never touches the database. Each test builds a
story whose composition is known by construction and asserts the measured counts
match it.
"""

from typing import Any

from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.quality import measure
from flyt.apps.story_generation.vocabulary import VocabularyClassifier

EXPECTED_MASTERED_LEMMA_COUNT = 2
EXPECTED_MASTERED_TOKEN_COUNT = 3
EXPECTED_IN_PROGRESS_TOKEN_COUNT = 2
EXPECTED_MIXED_LEXICAL_TOKEN_COUNT = 4
EXPECTED_PUNCTUATION_LEXICAL_TOKEN_COUNT = 2
EXPECTED_PUNCTUATION_UNRESOLVED_RATE = 0.5
EXPECTED_UNMAPPED_LEXICAL_TOKEN_COUNT = 2
EXPECTED_UNMAPPED_UNRESOLVED_RATE = 0.5


def _token(word: str, lemma_uuid: str | None) -> dict[str, Any]:
    return {"word": word, "start": 0, "end": len(word), "lemmaUuid": lemma_uuid}


def _pages(*tokens: dict[str, Any]) -> list[PageData]:
    return [
        PageData(
            index=0,
            content="",
            tokens=list(tokens),
            word_count=0,
        )
    ]


def test_measure_given_story_smaller_than_vocabulary_expect_counts_reflect_story() -> (
    None
):
    """R-003/R-007: mastered counts are measured from the story, not derived from
    the classifier's vocabulary size."""
    classifier = VocabularyClassifier(
        known_ids=frozenset({1, 2, 3, 4, 5}),
        in_progress_ids=frozenset({6, 7}),
    )
    uuid_to_id = {"a": 1, "b": 2}
    pages = _pages(_token("katt", "a"), _token("katt", "a"), _token("hund", "b"))

    quality = measure(pages, classifier, uuid_to_id, [])

    assert quality.mastered_lemma_count == EXPECTED_MASTERED_LEMMA_COUNT
    assert quality.mastered_token_count == EXPECTED_MASTERED_TOKEN_COUNT
    assert quality.in_progress_lemma_count == 0
    assert quality.in_progress_token_count == 0
    assert quality.unknown_lemma_count == 0


def test_measure_given_mixed_composition_expect_each_bucket_counted_separately() -> (
    None
):
    """R-003: mastered, in-progress, and unknown lemma and token counts are
    recorded separately."""
    classifier = VocabularyClassifier(
        known_ids=frozenset({1}),
        in_progress_ids=frozenset({2}),
    )
    uuid_to_id = {"a": 1, "b": 2, "c": 3}
    pages = _pages(
        _token("hus", "a"),
        _token("bil", "b"),
        _token("fly", "c"),
        _token("bil", "b"),
    )

    quality = measure(pages, classifier, uuid_to_id, [])

    assert quality.mastered_lemma_count == 1
    assert quality.mastered_token_count == 1
    assert quality.in_progress_lemma_count == 1
    assert quality.in_progress_token_count == EXPECTED_IN_PROGRESS_TOKEN_COUNT
    assert quality.unknown_lemma_count == 1
    assert quality.unknown_token_count == 1
    assert quality.lexical_token_count == EXPECTED_MIXED_LEXICAL_TOKEN_COUNT


def test_measure_given_punctuation_tokens_expect_excluded_from_unresolved_and_density() -> (
    None
):
    """R-007: punctuation (lemmaUuid None, as annotate_page_tokens emits it) does
    not inflate the unresolved rate or the lexical density."""
    classifier = VocabularyClassifier(
        known_ids=frozenset({1}),
        in_progress_ids=frozenset(),
    )
    uuid_to_id = {"a": 1}
    pages = _pages(
        _token("Hei", "a"),
        _token(",", None),
        _token("verden", None),
        _token(".", None),
    )

    quality = measure(pages, classifier, uuid_to_id, [])

    assert quality.lexical_token_count == EXPECTED_PUNCTUATION_LEXICAL_TOKEN_COUNT
    assert quality.mastered_token_count == 1
    assert quality.unresolved_token_rate == EXPECTED_PUNCTUATION_UNRESOLVED_RATE


def test_measure_given_unmapped_uuid_expect_unresolved_not_unknown() -> None:
    """R-007: a token whose lemma resolves to no stored lemma is unresolved, not
    a counted unknown."""
    classifier = VocabularyClassifier(
        known_ids=frozenset({1}),
        in_progress_ids=frozenset(),
    )
    uuid_to_id = {"a": 1}
    pages = _pages(_token("katt", "a"), _token("giraff", "ghost-uuid"))

    quality = measure(pages, classifier, uuid_to_id, [])

    assert quality.lexical_token_count == EXPECTED_UNMAPPED_LEXICAL_TOKEN_COUNT
    assert quality.unknown_token_count == 0
    assert quality.unknown_lemma_count == 0
    assert quality.unresolved_token_rate == EXPECTED_UNMAPPED_UNRESOLVED_RATE


def test_measure_given_target_missing_from_story_expect_explicit_zero() -> None:
    """R-010: the number of target words that appeared, and how often each
    appeared, are recorded — a requested target that never appears is an
    explicit zero."""
    classifier = VocabularyClassifier(
        known_ids=frozenset(),
        in_progress_ids=frozenset(),
    )
    uuid_to_id = {"a": 11, "b": 12}
    pages = _pages(_token("fjell", "a"), _token("fjell", "a"))

    quality = measure(pages, classifier, uuid_to_id, [11, 12])

    assert quality.target_occurrences == {11: 2, 12: 0}


def test_measure_given_inflected_form_expect_counts_toward_target_lemma() -> None:
    """R-010: an inflected surface form resolves through its lemma uuid and
    counts toward the target lemma."""
    classifier = VocabularyClassifier(
        known_ids=frozenset(),
        in_progress_ids=frozenset(),
    )
    uuid_to_id = {"paraply-uuid": 7}
    pages = _pages(_token("paraplyen", "paraply-uuid"))

    quality = measure(pages, classifier, uuid_to_id, [7])

    assert quality.target_occurrences == {7: 1}
    assert quality.unknown_lemma_count == 1
