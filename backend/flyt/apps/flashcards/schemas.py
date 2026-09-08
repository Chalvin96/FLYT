from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel
from pydantic import Field
from pydantic import field_validator
from pydantic import model_validator

from flyt.apps.flashcards.constants import ReviewOutcome
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import FlashCard as FlashCardModel
from flyt.apps.flashcards.models import LESSON_REVIEW_AUDIO_KEY
from flyt.apps.flashcards.types import DueCard
from flyt.apps.lessons.schemas import LessonAudioRead
from flyt.apps.lessons.schemas import learner_safe_exercise_payload
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.schemas import ExamplePair
from flyt.apps.lexicons.schemas import WordFormRead


class DefinitionEntry(BaseModel):
    uuid: str
    definition: str
    translation: str
    examples_json: list[ExamplePair] = []


class DefinitionPayload(BaseModel):
    lemma_uuid: str | None = None
    source_article_id: int | None = None
    source_lemma_id: int | None = None
    hgno: int | None = None
    # Norwegian sense cue, precomputed and shown only when this card shares a
    # (word, pos) with a sibling. None => nothing to show.
    sense_cue: str | None = None
    is_sub_article: bool | None = None
    word: str
    pos: LemmaPos
    primary_translation: str | None = None
    definitions: list[DefinitionEntry] = []
    ipa: str | None = None
    intonation: str | None = None
    ipa_approximate: bool = False
    audio_url: str | None = None


class FlashCardDefinition(BaseModel):
    id: int
    type: CardType = CardType.DEFINITION
    payload: DefinitionPayload
    schema_version: str | None = None
    deck_id: int | None = None


class FlashCardOperation(BaseModel):
    id: int
    type: Literal[
        CardType.RECALL_FILL,
        CardType.CHOOSE,
        CardType.CATEGORIZE,
        CardType.MATCH_PAIRS,
        CardType.BUILD,
        CardType.JUDGE,
        CardType.FIND_FIX,
        CardType.SPEAK,
        CardType.WRITE,
    ]
    payload: dict
    schema_version: str
    deck_id: int | None = None
    audio: LessonAudioRead | None = None


FlashCard = FlashCardDefinition | FlashCardOperation


def _strip_payload_metadata(payload: dict) -> dict:
    sanitized = dict(payload)
    sanitized.pop("activity_type", None)
    return sanitized


def serialize_flashcard(card: FlashCardModel) -> FlashCard:
    stored_payload = _strip_payload_metadata(card.payload_json)
    audio = _exercise_audio_asset(stored_payload.pop(LESSON_REVIEW_AUDIO_KEY, None))
    payload_json = learner_safe_exercise_payload(stored_payload)

    match card.type:
        case CardType.DEFINITION:
            return FlashCardDefinition(
                id=card.id,
                payload=DefinitionPayload.model_validate(payload_json),
                schema_version=card.schema_version,
                deck_id=card.deck_id,
            )
        case _:
            if card.schema_version is None:
                raise ValueError(f"Operation card {card.id} is missing schema_version")
            return FlashCardOperation(
                id=card.id,
                type=card.type,
                payload=payload_json,
                schema_version=card.schema_version,
                deck_id=card.deck_id,
                audio=audio,
            )


def _exercise_audio_asset(value: object) -> LessonAudioRead | None:
    if not isinstance(value, dict):
        return None
    return LessonAudioRead.model_validate(value)


class LemmaContextCreate(BaseModel):
    source_sentence: str = Field(min_length=1, max_length=2000)
    source_title: str | None = Field(default=None, max_length=300)

    @field_validator("source_sentence")
    @classmethod
    def strip_source_sentence(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Source sentence cannot be empty")
        return text

    @field_validator("source_title")
    @classmethod
    def strip_source_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class LemmaContextRead(BaseModel):
    model_config = {"from_attributes": True}

    source_sentence: str
    source_title: str | None = None


class UserCardRead(BaseModel):
    id: int
    user_id: int
    pool_id: int
    lesson_id: int | None = None
    card: FlashCard
    fsrs_stability: float | None
    fsrs_difficulty: float | None
    fsrs_step: int | None
    last_review_at: datetime | None
    due_at: datetime
    state: CardState
    word_forms: list[WordFormRead] = []
    rating_previews: dict[str, str] = {}
    context: LemmaContextRead | None = None

    @classmethod
    def from_due_card(cls, due_card: DueCard) -> "UserCardRead":
        user_card = due_card.user_card
        return cls(
            id=user_card.id,
            user_id=user_card.user_id,
            pool_id=user_card.pool_id,
            lesson_id=due_card.card.pool.lesson_id if due_card.card.pool else None,
            card=serialize_flashcard(due_card.card),
            fsrs_stability=user_card.fsrs_stability,
            fsrs_difficulty=user_card.fsrs_difficulty,
            fsrs_step=user_card.fsrs_step,
            last_review_at=user_card.last_review_at,
            due_at=user_card.due_at,
            state=user_card.state,
            word_forms=[WordFormRead.model_validate(wf) for wf in due_card.word_forms],
            rating_previews=due_card.rating_previews,
            context=(
                LemmaContextRead.model_validate(due_card.context)
                if due_card.context is not None
                else None
            ),
        )


class ReviewSubmission(BaseModel):
    """One review outcome: graded work schedules; ungraded work advances only.

    Speak/write exercises may finish without a grade. Those submissions carry
    ``skipped`` or ``service_unavailable`` and must not create scheduling
    evidence (no FSRS update, no review log).
    """

    card_id: int = Field(..., description="FlashCard variant issued for this card")
    outcome: ReviewOutcome = ReviewOutcome.GRADED
    rating: int | None = Field(
        default=None, ge=1, le=4, description="Rating: 1=Again, 2=Hard, 3=Good, 4=Easy"
    )

    @model_validator(mode="after")
    def graded_requires_rating(self) -> "ReviewSubmission":
        if self.outcome == ReviewOutcome.GRADED and self.rating is None:
            raise ValueError(f"{ReviewOutcome.GRADED.value} outcome requires a rating")
        if self.outcome != ReviewOutcome.GRADED and self.rating is not None:
            raise ValueError("ungraded outcome must not carry a rating")
        return self


class ReviewResult(BaseModel):
    new_remaining: int
    learning_remaining: int
    review_remaining: int
    card_state: CardState
    due_at: datetime


class AddMoreNewResponse(BaseModel):
    promoted: int


# --- My Cards gallery ---


MasteryBucket = Literal["not_started", "learning", "familiar", "known", "mastered"]
CardFacet = Literal["all", "vocab", "grammar"]
CardSort = Literal["weakest", "recent", "alpha"]


class MyCardsSummary(BaseModel):
    total: int
    counts_by_bucket: dict[MasteryBucket, int]


class MyCardItem(BaseModel):
    user_card_id: int
    facet: Literal["vocab", "grammar"]
    label: str
    subtitle: str | None = None
    bucket: MasteryBucket
    lemma_uuid: UUID | None = None
    lesson_id: int | None = None
    lesson_title: str | None = None


class MyCardsResponse(BaseModel):
    cards: list[MyCardItem]
    summary: MyCardsSummary
    page: int
    limit: int
    has_more: bool


# --- Deck browse ---


class DeckSummaryItem(BaseModel):
    id: int
    name: str
    description: str | None = None
    card_count: int
    cefr_range: str | None = None
    is_subscribed: bool
    studied_count: int
