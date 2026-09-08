"""Fixed synthetic learner profiles for offline generation evaluation (R-009).

The frequency deck is the real production deck, loaded from the database and
sliced to the ranks each profile needs; selection reuses the production static
methods on ``VocabularyService`` and mirrors production's bounded target query
(unknown lemmas, frequency first). Token resolution is synthetic: each token's
spaCy lemma maps to the production lemma uuid when in the deck, ``None``
otherwise. Nothing here calls a provider or measures a signal.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import anyio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Lemma
from flyt.apps.reading.tokenization import PageData
from flyt.apps.reading.tokenization import paginate
from flyt.apps.reading.tokenization import raw_tokens_batch
from flyt.apps.story_generation.vocabulary import AnchorType
from flyt.apps.story_generation.vocabulary import FrequencyLemma
from flyt.apps.story_generation.vocabulary import VocabularyClassifier
from flyt.apps.story_generation.vocabulary import VocabularySelection
from flyt.apps.story_generation.vocabulary import VocabularyService
from flyt.apps.story_generation.vocabulary import VocabularyStatus
from flyt.apps.story_generation.vocabulary import derive_target_count
from flyt.core.config import settings


@dataclass(frozen=True)
class EvalProfile:
    """One fixed synthetic learner over a prefix of the production deck."""

    name: str
    anchor: AnchorType | None
    requested_length: int
    mastered_rank: int
    in_progress_rank: int
    topic: str | None = None


PROFILES: list[EvalProfile] = [
    EvalProfile("beginner", AnchorType.DECK, 250, 120, 123, "Regn i Bergen"),
    EvalProfile("mid", AnchorType.NONE, 250, 200, 203, "En tur i fjellet"),
    EvalProfile("advanced", AnchorType.FREQUENCY, 250, 600, 604),
]


@dataclass(frozen=True)
class EvalDeck:
    lemmas: list[FrequencyLemma]
    uuid_by_word: dict[str, str]
    uuid_to_id: dict[str, int]


async def load_eval_deck(db: AsyncSession, profile: EvalProfile) -> EvalDeck:
    """Load the production frequency deck up to the ranks the profile needs."""
    need = profile.in_progress_rank + derive_target_count(profile.requested_length)
    rows = (
        await db.execute(
            select(Lemma.id, Lemma.word, Lemma.frequency_rank, Lemma.uuid)
            .where(Lemma.frequency_rank.is_not(None))
            .order_by(Lemma.frequency_rank.asc())
            .limit(need)
        )
    ).all()
    lemmas = [
        FrequencyLemma(id=row[0], word=row[1], frequency_rank=row[2]) for row in rows
    ]
    return EvalDeck(
        lemmas=lemmas,
        uuid_by_word={row[1]: str(row[3]) for row in rows},
        uuid_to_id={str(row[3]): row[0] for row in rows},
    )


def build_selection(profile: EvalProfile, deck: EvalDeck) -> VocabularySelection:
    """Run the production selection logic against a fixed profile, offline."""
    known = {lemma.id for lemma in deck.lemmas[: profile.mastered_rank]}
    in_progress = {
        lemma.id
        for lemma in deck.lemmas[profile.mastered_rank : profile.in_progress_rank]
    }
    classifier = VocabularyClassifier(
        known_ids=frozenset(known), in_progress_ids=frozenset(in_progress)
    )
    base_ids = VocabularyService._resolve_base(profile.anchor, classifier, deck.lemmas)
    word_by_id = {lemma.id: lemma.word for lemma in deck.lemmas}
    base_words, base_truncated = VocabularyService._bound_base(
        base_ids, word_by_id, deck.lemmas
    )
    target_count = derive_target_count(profile.requested_length)
    target_words, target_ids = _select_targets(classifier, deck.lemmas, target_count)
    return VocabularySelection(
        classifier=classifier,
        anchor=profile.anchor,
        base_words=base_words,
        base_truncated=base_truncated,
        target_words=target_words,
        target_lemma_ids=target_ids,
    )


def _select_targets(
    classifier: VocabularyClassifier,
    lemmas: list[FrequencyLemma],
    count: int,
) -> tuple[list[str], list[int]]:
    """Unknown lemmas, common first — mirrors production's bounded target query."""
    unknown = [
        lemma
        for lemma in lemmas
        if classifier.classify(lemma.id) is VocabularyStatus.UNKNOWN
    ]
    selected = sorted(unknown, key=lambda lemma: lemma.frequency_rank)[:count]
    return ([lemma.word for lemma in selected], [lemma.id for lemma in selected])


async def build_pages(text: str, deck: EvalDeck) -> list[PageData]:
    """Paginate and annotate text against the production deck.

    Mirrors ``reading.annotation.build_pages`` but resolves each token's spaCy lemma
    to the production lemma uuid (or ``None``), so ``quality.measure`` consumes
    pages identical in shape to production's.
    """
    slices = paginate(text, settings.READING_PAGE_TARGET_WORDS)
    raw_tokens_per_page = await anyio.to_thread.run_sync(raw_tokens_batch, slices)
    pages: list[PageData] = []
    for index, (slice_text, raw_tokens) in enumerate(
        zip(slices, raw_tokens_per_page, strict=True)
    ):
        tokens: list[dict[str, Any]] = []
        for word, start, end, is_alpha, token_lemma, _pos in raw_tokens:
            lemma_uuid = (
                deck.uuid_by_word.get(token_lemma.lower()) if is_alpha else None
            )
            tokens.append(
                {"word": word, "start": start, "end": end, "lemmaUuid": lemma_uuid}
            )
        pages.append(
            PageData(
                index=index,
                content=slice_text,
                tokens=tokens,
                word_count=len(slice_text.split()),
            )
        )
    return pages
