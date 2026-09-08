from datetime import datetime
from uuid import UUID
from uuid import uuid4

from sqlalchemy import Boolean
from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Uuid
from sqlalchemy import UniqueConstraint
from sqlalchemy import true
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin
from flyt.apps.users.types import UserRole


class User(BaseModel, DateTimeMixin):
    __tablename__ = "user_users"

    uuid: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), unique=True, nullable=False, default=uuid4
    )
    email: Mapped[str] = mapped_column(String)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        default=UserRole.USER,
        server_default=UserRole.USER.value,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )

    def __str__(self):
        return self.display_name


class AuthIdentity(BaseModel, DateTimeMixin):
    __tablename__ = "user_auth_identities"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email_at_link: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("provider", "provider_subject"),
        UniqueConstraint("user_id", "provider"),
    )


class UserLemma(BaseModel, DateTimeMixin):
    __tablename__ = "user_user_lemmas"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user_users.id", ondelete="CASCADE"), index=True
    )
    lemma_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lexicon_lemmas.id"), index=True
    )
    is_mastered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "lemma_id"),)


class UserLemmaContext(BaseModel, DateTimeMixin):
    __tablename__ = "user_lemma_contexts"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lemma_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lexicon_lemmas.id"),
        nullable=False,
        index=True,
    )
    source_sentence: Mapped[str] = mapped_column(String(2000), nullable=False)
    source_title: Mapped[str | None] = mapped_column(String(300), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "lemma_id",
            "source_sentence",
            name="uq_user_lemma_context_source",
        ),
    )


class UserSettings(BaseModel, DateTimeMixin):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    daily_new_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=20, server_default="20"
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
