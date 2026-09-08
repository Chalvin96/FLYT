"""Models for story generation observability."""

from enum import StrEnum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import JSON
from sqlalchemy import String
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.apps.story_generation.constants import ANCHOR_MAX_LENGTH
from flyt.apps.story_generation.constants import ERROR_CODE_MAX_LENGTH
from flyt.apps.story_generation.constants import ERROR_MESSAGE_MAX_LENGTH
from flyt.apps.story_generation.constants import FAILURE_CLASS_MAX_LENGTH
from flyt.apps.story_generation.constants import MODEL_ID_MAX_LENGTH
from flyt.apps.story_generation.constants import PROVIDER_NAME_MAX_LENGTH
from flyt.apps.story_generation.constants import UPSTREAM_IDENTIFIER_MAX_LENGTH
from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin


class GenerationOutcome(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    REFUSED = "refused"


class ProviderRequestOutcome(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"


class Generation(BaseModel, DateTimeMixin):
    __tablename__ = "story_generation_generations"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "user_users.id",
            name="fk_story_generation_generations_user_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    anchor: Mapped[str | None] = mapped_column(String(ANCHOR_MAX_LENGTH), nullable=True)
    requested_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requested_targets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mastered_lemma_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    in_progress_lemma_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unknown_lemma_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mastered_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    in_progress_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unknown_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lexical_token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_occurrences: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    unresolved_token_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    produced_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[GenerationOutcome] = mapped_column(
        SAEnum(
            GenerationOutcome,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        index=True,
    )
    failure_code: Mapped[str | None] = mapped_column(
        String(ERROR_CODE_MAX_LENGTH), nullable=True
    )
    failure_message: Mapped[str | None] = mapped_column(
        String(ERROR_MESSAGE_MAX_LENGTH), nullable=True
    )

    provider_requests = relationship(
        "ProviderRequest",
        back_populates="generation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ProviderRequest(BaseModel, DateTimeMixin):
    __tablename__ = "story_generation_provider_requests"

    generation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "story_generation_generations.id",
            name="fk_story_generation_provider_requests_generation_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(PROVIDER_NAME_MAX_LENGTH), nullable=False
    )
    model: Mapped[str] = mapped_column(String(MODEL_ID_MAX_LENGTH), nullable=False)
    outcome: Mapped[ProviderRequestOutcome] = mapped_column(
        SAEnum(
            ProviderRequestOutcome,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
    )
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    failure_class: Mapped[str | None] = mapped_column(
        String(FAILURE_CLASS_MAX_LENGTH), nullable=True
    )
    upstream_identifier: Mapped[str | None] = mapped_column(
        String(UPSTREAM_IDENTIFIER_MAX_LENGTH), nullable=True
    )

    generation = relationship("Generation", back_populates="provider_requests")
