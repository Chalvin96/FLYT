from enum import Enum as PyEnum
from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import Enum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import JSON
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import Uuid
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.apps.reading.constants import SOURCE_URL_MAX_LENGTH
from flyt.apps.reading.constants import TITLE_MAX_LENGTH
from flyt.apps.reading.constants import CONTENT_HASH_LENGTH
from flyt.apps.reading.constants import ERROR_CODE_MAX_LENGTH
from flyt.apps.reading.constants import ERROR_MESSAGE_MAX_LENGTH
from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin


class StoryVisibility(PyEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class ReadingGroup(BaseModel, DateTimeMixin):
    __tablename__ = "reading_groups"

    key: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    stories = relationship(
        "Story",
        back_populates="reading_group",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Story(BaseModel, DateTimeMixin):
    __tablename__ = "reading_stories"

    uuid: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), unique=True, nullable=False, default=uuid4, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    # Imports store their normalized source text here; curated ingest also uses it.
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The three columns below are curation-only. Imports have no CEFR level, no
    # public slug and no reading group; curated ingest enforces them.
    cefr_level: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    slug: Mapped[str | None] = mapped_column(
        String, unique=True, nullable=True, index=True
    )
    # Fail-closed default. Curated ingest sets PUBLIC explicitly; imports are PRIVATE.
    visibility: Mapped[StoryVisibility] = mapped_column(
        Enum(
            StoryVisibility,
            name="storyvisibility",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        server_default=StoryVisibility.PRIVATE.value,
        default=StoryVisibility.PRIVATE,
        index=True,
    )
    # Authoritative only for curated PUBLIC reads; private imports gate on ImportMeta.status instead.
    is_ready: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reading_group_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("reading_groups.id", name="fk_reading_stories_reading_group_id"),
        nullable=True,
        index=True,
    )

    reading_group = relationship(
        "ReadingGroup", back_populates="stories", lazy="selectin"
    )
    pages = relationship(
        "StoryPage",
        back_populates="story",
        cascade="all, delete-orphan",
        order_by="StoryPage.index",
        lazy="selectin",
    )
    user_stories = relationship(
        "UserStory",
        back_populates="story",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class UserStory(BaseModel, DateTimeMixin):
    __tablename__ = "user_stories"

    # Always assigned, curated and import alike. The import-vs-curated discriminant
    # is Story.visibility == PRIVATE, not this column.
    uuid: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), unique=True, nullable=False, default=uuid4, index=True
    )
    title: Mapped[str | None] = mapped_column(String(TITLE_MAX_LENGTH), nullable=True)
    source_url: Mapped[str | None] = mapped_column(
        String(SOURCE_URL_MAX_LENGTH), nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", name="fk_user_stories_user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    story_id: Mapped[int] = mapped_column(
        Integer,
        # CASCADE: deleting a story removes its per-user rows (import last-owner delete).
        ForeignKey(
            "reading_stories.id", name="fk_user_stories_story_id", ondelete="CASCADE"
        ),
        nullable=False,
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    story = relationship("Story", back_populates="user_stories", lazy="selectin")
    last_page_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "story_id", name="uq_user_story_user_story"),
    )


class StoryPage(BaseModel, DateTimeMixin):
    __tablename__ = "reading_story_pages"

    story_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("reading_stories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Inline per-page tokens (curated + import). Nullable: the row exists before
    # annotation completes.
    text_annotations_json: Mapped[list[dict] | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    word_count: Mapped[int] = mapped_column(Integer, nullable=False)

    story = relationship("Story", back_populates="pages", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("story_id", "index", name="uq_story_page_story_index"),
    )


class ImportStatus(PyEnum):
    """Observable processing lifecycle of imported content."""

    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ImportMeta(BaseModel, DateTimeMixin):
    """Content-scoped sidecar marking a ``Story`` as import-kind."""

    __tablename__ = "import_meta"

    story_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "reading_stories.id",
            name="fk_import_meta_story_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )
    content_hash: Mapped[str] = mapped_column(
        String(CONTENT_HASH_LENGTH), nullable=False, unique=True, index=True
    )
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus), nullable=False, default=ImportStatus.PENDING, index=True
    )
    error_code: Mapped[str | None] = mapped_column(
        String(ERROR_CODE_MAX_LENGTH), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(
        String(ERROR_MESSAGE_MAX_LENGTH), nullable=True
    )

    story = relationship("Story", lazy="selectin")


class ImportQuota(BaseModel):
    """Monotonic lifetime count of imports a user has created.

    Incremented once per new import association; never decremented on delete, so the
    cap is a true lifetime limit, not a 'currently saved' limit.
    """

    __tablename__ = "story_import_quota"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "user_users.id",
            name="fk_story_import_quota_user_id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
        index=True,
    )
    used: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
