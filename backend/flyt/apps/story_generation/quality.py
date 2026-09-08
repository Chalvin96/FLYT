"""Quality measurement for a generated story.

``measure`` is pure — pages, a classifier, a uuid-to-id map, and the target
lemma ids in, composition counts out — so it can run offline against fixed
profiles. ``resolve_lemma_ids`` is its DB boundary.
"""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Lemma
from flyt.apps.reading.tokenization import PageData
from flyt.apps.story_generation.vocabulary import VocabularyClassifier
from flyt.apps.story_generation.vocabulary import VocabularyStatus


@dataclass(frozen=True)
class QualityMeasurement:
    lexical_token_count: int
    unresolved_token_rate: float
    mastered_lemma_count: int
    in_progress_lemma_count: int
    unknown_lemma_count: int
    mastered_token_count: int
    in_progress_token_count: int
    unknown_token_count: int
    target_occurrences: dict[int, int]


def measure(
    pages: list[PageData],
    classifier: VocabularyClassifier,
    uuid_to_id: dict[str, int],
    target_lemma_ids: list[int],
) -> QualityMeasurement:
    target_occurrences = {target_id: 0 for target_id in target_lemma_ids}
    mastered_lemmas: set[int] = set()
    in_progress_lemmas: set[int] = set()
    unknown_lemmas: set[int] = set()
    mastered_tokens = 0
    in_progress_tokens = 0
    unknown_tokens = 0
    unresolved_tokens = 0
    lexical_tokens = 0

    for page in pages:
        for token in page.tokens:
            if not _is_lexical(token.get("word")):
                continue
            lexical_tokens += 1
            lemma_id = uuid_to_id.get(str(token.get("lemmaUuid")))
            if lemma_id is None:
                unresolved_tokens += 1
                continue
            if lemma_id in target_occurrences:
                target_occurrences[lemma_id] += 1
            status = classifier.classify(lemma_id)
            if status is VocabularyStatus.KNOWN:
                mastered_lemmas.add(lemma_id)
                mastered_tokens += 1
            elif status is VocabularyStatus.IN_PROGRESS:
                in_progress_lemmas.add(lemma_id)
                in_progress_tokens += 1
            else:
                unknown_lemmas.add(lemma_id)
                unknown_tokens += 1

    unresolved_rate = 0.0
    if lexical_tokens > 0:
        unresolved_rate = round(unresolved_tokens / lexical_tokens, 4)

    return QualityMeasurement(
        lexical_token_count=lexical_tokens,
        unresolved_token_rate=unresolved_rate,
        mastered_lemma_count=len(mastered_lemmas),
        in_progress_lemma_count=len(in_progress_lemmas),
        unknown_lemma_count=len(unknown_lemmas),
        mastered_token_count=mastered_tokens,
        in_progress_token_count=in_progress_tokens,
        unknown_token_count=unknown_tokens,
        target_occurrences=target_occurrences,
    )


async def resolve_lemma_ids(db: AsyncSession, pages: list[PageData]) -> dict[str, int]:
    """Map distinct token lemma uuids to Lemma ids at the generation boundary."""
    uuids: set[UUID] = set()
    for page in pages:
        for token in page.tokens:
            raw = token.get("lemmaUuid")
            if not raw:
                continue
            try:
                uuids.add(UUID(str(raw)))
            except (ValueError, AttributeError):
                continue
    if not uuids:
        return {}
    rows = (
        await db.execute(select(Lemma.id, Lemma.uuid).where(Lemma.uuid.in_(uuids)))
    ).all()
    return {str(uuid): lemma_id for lemma_id, uuid in rows}


def _is_lexical(word: Any) -> bool:
    return isinstance(word, str) and any(ch.isalpha() for ch in word)
