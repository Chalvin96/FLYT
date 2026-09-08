from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID

from sqlalchemy import JSON
from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import Enum
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import Uuid
from sqlalchemy import UniqueConstraint

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin

LESSON_REVIEW_AUDIO_KEY = "_lesson_review_audio"


class CardType(PyEnum):
    DEFINITION = "definition"
    RECALL_FILL = "recall_fill"
    CHOOSE = "choose"
    CATEGORIZE = "categorize"
    MATCH_PAIRS = "match_pairs"
    BUILD = "build"
    JUDGE = "judge"
    FIND_FIX = "find_fix"
    SPEAK = "speak"
    WRITE = "write"


class CardState(PyEnum):
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"


class Enrollment(PyEnum):
    ACTIVE = "active"
    UPCOMING = "upcoming"


class Deck(BaseModel, DateTimeMixin):
    __tablename__ = "flashcard_decks"

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    license: Mapped[str | None] = mapped_column(Text, nullable=True)
    cefr_range: Mapped[str | None] = mapped_column(String, nullable=True)

    cards = relationship("FlashCard", back_populates="deck", lazy="selectin")

    def __str__(self):
        return self.name


class CardPool(BaseModel, DateTimeMixin):
    __tablename__ = "flashcard_card_pools"

    lesson_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("lesson_lessons.id"),
        nullable=True,
        index=True,
    )
    lemma_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "lexicon_lemmas.id",
            name="fk_flashcard_card_pools_lemma_id",
        ),
        nullable=True,
        index=True,
        unique=True,
    )
    key: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_rank: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    lesson = relationship("Lesson", back_populates="pools", lazy="selectin")
    lemma = relationship("Lemma", back_populates=None, lazy="selectin")
    cards = relationship("FlashCard", back_populates="pool", lazy="selectin")

    __table_args__ = (
        CheckConstraint(
            "(lesson_id IS NULL) <> (lemma_id IS NULL)",
            name="ck_card_pool_exactly_one_owner",
        ),
        UniqueConstraint("lesson_id", "key", name="uq_card_pool_lesson_key"),
    )


class FlashCard(BaseModel, DateTimeMixin):
    __tablename__ = "flashcard_cards"

    type: Mapped[CardType] = mapped_column(Enum(CardType), nullable=False, index=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    schema_version: Mapped[str | None] = mapped_column(String, nullable=True)
    is_addable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deck_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("flashcard_decks.id"), nullable=True, index=True
    )
    pool_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("flashcard_card_pools.id", name="fk_flashcard_cards_pool_id"),
        nullable=True,
        index=True,
    )
    uuid: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True, unique=True
    )

    deck = relationship("Deck", back_populates="cards", lazy="selectin")
    pool = relationship("CardPool", back_populates="cards", lazy="selectin")

    __table_args__ = (
        Index(
            "ix_flashcard_cards_deck_addable_pool",
            "deck_id",
            "is_addable",
            "pool_id",
        ),
    )

    def __str__(self):
        return f"FlashCard {self.id} ({self.type})"


class UserCard(BaseModel, DateTimeMixin):
    __tablename__ = "flashcard_user_cards"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pool_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("flashcard_card_pools.id", name="fk_user_cards_pool_id"),
        nullable=False,
        index=True,
    )
    last_shown_card_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "flashcard_cards.id",
            name="fk_user_cards_last_shown_card_id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    active_card_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "flashcard_cards.id",
            name="fk_user_cards_active_card_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    fsrs_stability: Mapped[float | None] = mapped_column(Float, nullable=True)
    fsrs_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    fsrs_step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_review_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    introduced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    state: Mapped[CardState] = mapped_column(
        Enum(CardState), nullable=False, index=True, default=CardState.NEW
    )
    enrollment_state: Mapped[Enrollment] = mapped_column(
        Enum(
            Enrollment,
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=Enrollment.ACTIVE,
        server_default="active",
    )

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    pool = relationship("CardPool", foreign_keys=[pool_id], lazy="selectin")
    last_shown_card = relationship(
        "FlashCard", foreign_keys=[last_shown_card_id], lazy="selectin"
    )
    active_card = relationship(
        "FlashCard", foreign_keys=[active_card_id], lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "pool_id", name="uq_user_card_pool"),
        Index(
            "ix_flashcard_user_cards_user_id_state",
            "user_id",
            "state",
        ),
        Index(
            "ix_flashcard_user_cards_user_id_enrollment_state_state",
            "user_id",
            "enrollment_state",
            "state",
        ),
    )

    def __str__(self):
        return f"UserCard {self.id} (user={self.user_id}, pool={self.pool_id})"


class StatsReviewLog(BaseModel, DateTimeMixin):
    __tablename__ = "stats_review_logs"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_users.id", ondelete="CASCADE"), nullable=False
    )
    user_card_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("flashcard_user_cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    user_card = relationship("UserCard", foreign_keys=[user_card_id], lazy="selectin")

    __table_args__ = (
        Index(
            "ix_stats_review_logs_user_id_reviewed_at",
            "user_id",
            "reviewed_at",
        ),
    )
