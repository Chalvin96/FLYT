"""Vocabulary selection for story generation.

One classifier over UserLemma plus flashcard state, used by anchoring, target
selection, and measurement alike. Three anchors — frequency deck, own deck,
none — with the deck anchor unavailable below the minimum size. Targets are
derived from length x density, never a free parameter.
"""

from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lexicons.models import Lemma
from flyt.apps.users.models import UserLemma
from flyt.core.config import settings


class VocabularyStatus(StrEnum):
    KNOWN = "known"
    IN_PROGRESS = "in_progress"
    UNKNOWN = "unknown"


class AnchorType(StrEnum):
    FREQUENCY = "frequency"
    DECK = "deck"
    NONE = "none"


@dataclass(frozen=True)
class VocabularyClassifier:
    known_ids: frozenset[int]
    in_progress_ids: frozenset[int]

    def classify(self, lemma_id: int) -> VocabularyStatus:
        if lemma_id in self.known_ids:
            return VocabularyStatus.KNOWN
        if lemma_id in self.in_progress_ids:
            return VocabularyStatus.IN_PROGRESS
        return VocabularyStatus.UNKNOWN

    @property
    def comprehensible_ids(self) -> frozenset[int]:
        return self.known_ids | self.in_progress_ids


@dataclass(frozen=True)
class AnchorAvailability:
    type: AnchorType
    available: bool
    reason: str | None = None


@dataclass(frozen=True)
class AnchorChoices:
    choices: list[AnchorAvailability]
    deck_collapses_with_frequency: bool


@dataclass(frozen=True)
class FrequencyLemma:
    id: int
    word: str
    frequency_rank: int


@dataclass(frozen=True)
class VocabularySelection:
    classifier: VocabularyClassifier
    anchor: AnchorType | None
    base_words: list[str]
    base_truncated: bool
    target_words: list[str]
    target_lemma_ids: list[int]


class VocabularyService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def build_classifier(self, user_id: int) -> VocabularyClassifier:
        known: set[int] = set()
        in_progress: set[int] = set()

        rows = (
            await self._db.execute(
                select(UserLemma.lemma_id, UserLemma.is_mastered).where(
                    UserLemma.user_id == user_id
                )
            )
        ).all()
        for lemma_id, is_mastered in rows:
            if is_mastered:
                known.add(lemma_id)
            else:
                in_progress.add(lemma_id)

        card_lemmas = (
            (
                await self._db.execute(
                    select(CardPool.lemma_id)
                    .join(UserCard, UserCard.pool_id == CardPool.id)
                    .where(
                        UserCard.user_id == user_id,
                        UserCard.enrollment_state == Enrollment.ACTIVE,
                        CardPool.lemma_id.is_not(None),
                    )
                    .distinct()
                )
            )
            .scalars()
            .all()
        )
        for lemma_id in card_lemmas:
            if lemma_id is not None and lemma_id not in known:
                in_progress.add(lemma_id)

        return VocabularyClassifier(
            known_ids=frozenset(known),
            in_progress_ids=frozenset(in_progress),
        )

    async def _frequency_deck(self) -> list[FrequencyLemma]:
        rows = (
            await self._db.execute(
                select(Lemma.id, Lemma.word, Lemma.frequency_rank)
                .where(Lemma.frequency_rank.is_not(None))
                .order_by(Lemma.frequency_rank.asc())
                .limit(settings.STORY_GENERATION_FREQUENCY_DECK_SIZE)
            )
        ).all()
        return [FrequencyLemma(id=r[0], word=r[1], frequency_rank=r[2]) for r in rows]

    async def anchor_choices(self, user_id: int) -> AnchorChoices:
        classifier = await self.build_classifier(user_id)
        deck_size = len(classifier.comprehensible_ids)
        min_deck = settings.STORY_GENERATION_MIN_DECK_SIZE

        deck_available = deck_size >= min_deck
        deck_reason = None if deck_available else "deck_below_minimum"

        frequency = AnchorAvailability(type=AnchorType.FREQUENCY, available=True)
        deck = AnchorAvailability(
            type=AnchorType.DECK,
            available=deck_available,
            reason=deck_reason,
        )
        none = AnchorAvailability(type=AnchorType.NONE, available=True)

        collapses = await self._deck_collapses_with_frequency(
            classifier, deck_available
        )

        return AnchorChoices(
            choices=[frequency, deck, none],
            deck_collapses_with_frequency=collapses,
        )

    async def _deck_collapses_with_frequency(
        self,
        classifier: VocabularyClassifier,
        deck_available: bool,
    ) -> bool:
        if not deck_available:
            return False
        deck_ids = classifier.comprehensible_ids
        if not deck_ids:
            return False
        freq_count = await self._db.scalar(
            select(func.count(Lemma.id)).where(Lemma.frequency_rank.is_not(None))
        )
        if freq_count is None or freq_count == 0:
            return False
        if len(deck_ids) != freq_count:
            return False
        freq_in_deck = await self._db.scalar(
            select(func.count(Lemma.id)).where(
                Lemma.frequency_rank.is_not(None),
                Lemma.id.in_(list(deck_ids)),
            )
        )
        return freq_in_deck == freq_count

    async def select(
        self,
        user_id: int,
        anchor: AnchorType | None,
        length: int,
    ) -> VocabularySelection:
        classifier = await self.build_classifier(user_id)
        freq_deck = await self._frequency_deck()

        base_lemma_ids = self._resolve_base(anchor, classifier, freq_deck)
        word_by_id = await self._word_map(base_lemma_ids, freq_deck)
        base_words, truncated = self._bound_base(base_lemma_ids, word_by_id, freq_deck)

        target_count = derive_target_count(length)
        target_words, target_ids = await self._select_targets(classifier, target_count)

        return VocabularySelection(
            classifier=classifier,
            anchor=anchor,
            base_words=base_words,
            base_truncated=truncated,
            target_words=target_words,
            target_lemma_ids=target_ids,
        )

    @staticmethod
    def _resolve_base(
        anchor: AnchorType | None,
        classifier: VocabularyClassifier,
        freq_deck: list[FrequencyLemma],
    ) -> list[int]:
        if anchor is None or anchor is AnchorType.NONE:
            return []

        if anchor is AnchorType.FREQUENCY:
            comprehensible = classifier.comprehensible_ids
            return [fl.id for fl in freq_deck if fl.id in comprehensible]

        if anchor is AnchorType.DECK:
            freq_by_id = {fl.id: fl for fl in freq_deck}
            deck_ids = classifier.comprehensible_ids
            non_freq = [lid for lid in deck_ids if lid not in freq_by_id]
            freq_in_deck = [fl.id for fl in freq_deck if fl.id in deck_ids]
            return non_freq + freq_in_deck

        return []

    async def _word_map(
        self,
        lemma_ids: list[int],
        freq_deck: list[FrequencyLemma],
    ) -> dict[int, str]:
        word_by_id = {fl.id: fl.word for fl in freq_deck}
        missing = [lid for lid in lemma_ids if lid not in word_by_id]
        if not missing:
            return word_by_id
        rows = (
            await self._db.execute(
                select(Lemma.id, Lemma.word).where(Lemma.id.in_(missing))
            )
        ).all()
        word_by_id.update({lid: word for lid, word in rows})
        return word_by_id

    @staticmethod
    def _bound_base(
        lemma_ids: list[int],
        word_by_id: dict[int, str],
        freq_deck: list[FrequencyLemma],
    ) -> tuple[list[str], bool]:
        bound = settings.STORY_GENERATION_PROMPT_VOCABULARY_BOUND
        if len(lemma_ids) <= bound:
            words = [word_by_id[lid] for lid in lemma_ids if lid in word_by_id]
            return words, False

        freq_by_id = {fl.id: fl for fl in freq_deck}
        ranked = sorted(
            lemma_ids,
            key=lambda lid: (
                freq_by_id[lid].frequency_rank if lid in freq_by_id else 999_999
            ),
        )
        sampled = ranked[:bound]
        words = [word_by_id[lid] for lid in sampled if lid in word_by_id]
        return words, True

    async def _select_targets(
        self,
        classifier: VocabularyClassifier,
        count: int,
    ) -> tuple[list[str], list[int]]:
        comprehensible = classifier.comprehensible_ids
        stmt = (
            select(Lemma.id, Lemma.word)
            .order_by(Lemma.frequency_rank.asc().nulls_last(), Lemma.id)
            .limit(count)
        )
        if comprehensible:
            stmt = stmt.where(Lemma.id.not_in(comprehensible))
        rows = (await self._db.execute(stmt)).all()
        return ([word for _, word in rows], [lemma_id for lemma_id, _ in rows])


_WORDS_PER_TARGET_OCCURRENCE = 3
_MIN_TARGET_COUNT = 2
_MAX_TARGET_COUNT = 4


def derive_target_count(length: int) -> int:
    density = (
        settings.STORY_GENERATION_DENSITY_MIN + settings.STORY_GENERATION_DENSITY_MAX
    ) / 2
    raw = round(length * density / _WORDS_PER_TARGET_OCCURRENCE)
    return max(_MIN_TARGET_COUNT, min(_MAX_TARGET_COUNT, raw))


def has_unknown_targets(selection: VocabularySelection) -> bool:
    return len(selection.target_lemma_ids) > 0
