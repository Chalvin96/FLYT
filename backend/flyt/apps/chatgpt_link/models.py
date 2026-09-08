from datetime import datetime
from enum import StrEnum

from pydantic import SecretStr
from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin
from flyt.core.fields import EncryptedTextField


class ChatGPTLinkState(StrEnum):
    WORKING = "working"
    BROKEN = "broken"


class ChatGPTLink(BaseModel, DateTimeMixin):
    __tablename__ = "chatgpt_link"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    access_token: Mapped[SecretStr] = mapped_column(EncryptedTextField, nullable=False)
    refresh_token: Mapped[SecretStr] = mapped_column(EncryptedTextField, nullable=False)
    chatgpt_account_id: Mapped[str] = mapped_column(String, nullable=False)
    access_token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    state: Mapped[ChatGPTLinkState] = mapped_column(
        SAEnum(
            ChatGPTLinkState,
            native_enum=False,
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        default=ChatGPTLinkState.WORKING,
        server_default=ChatGPTLinkState.WORKING.value,
    )
    broken_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    model_key: Mapped[str | None] = mapped_column(String, nullable=True)
    last_refresh_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
