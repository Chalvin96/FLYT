from pydantic import SecretStr
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from flyt.core.base import BaseModel
from flyt.core.base import DateTimeMixin
from flyt.core.fields import EncryptedTextField


class OpenRouterCredential(BaseModel, DateTimeMixin):
    __tablename__ = "chatbot_openrouter_credentials"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "user_users.id",
            name="fk_chatbot_openrouter_credentials_user_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )
    api_key: Mapped[SecretStr] = mapped_column(EncryptedTextField, nullable=False)
