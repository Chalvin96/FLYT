from datetime import datetime

from sqlalchemy import JSON
from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin


class LessonRelease(BaseModel, DateTimeMixin):
    __tablename__ = "lesson_releases"

    source: Mapped[str] = mapped_column(Text, nullable=False)
    digest: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    schema_version: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, nullable=False)
    translation_language: Mapped[str] = mapped_column(String, nullable=False)
    lesson_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )

    # Explicit loads only: lesson reads must not materialize every packet in
    # the activated revision through relationship defaults.
    lessons = relationship(
        "Lesson",
        back_populates="release",
        lazy="select",
        order_by="Lesson.release_order",
    )


class Lesson(BaseModel, DateTimeMixin):
    __tablename__ = "lesson_lessons"

    release_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lesson_releases.id", name="fk_lesson_lessons_release_id"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    release_order: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    family_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    cefr_level: Mapped[str | None] = mapped_column(String, nullable=True)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    packet_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    release = relationship("LessonRelease", back_populates="lessons", lazy="select")
    user_progress = relationship(
        "UserLessonProgress", back_populates="lesson", lazy="select"
    )
    pools = relationship("CardPool", back_populates="lesson", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("release_id", "source_id", name="uq_lesson_release_source_id"),
    )


class UserLessonProgress(BaseModel, DateTimeMixin):
    __tablename__ = "lesson_user_progress"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lesson_lessons.id"),
        nullable=False,
        index=True,
    )
    completed_exercise_ids_json: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id], lazy="select")
    lesson = relationship("Lesson", back_populates="user_progress", lazy="select")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "lesson_id", name="uq_user_lesson_progress_user_lesson"
        ),
    )
