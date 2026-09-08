from datetime import date
from datetime import datetime

from sqlalchemy import BigInteger
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from flyt.apps.ai_usage.constants import K_AI_USAGE_PROVIDER_MAX_LENGTH
from flyt.core.base import BaseModel


class FlytAiUsage(BaseModel):
    __tablename__ = "flyt_ai_usage"

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "user_users.id",
            name="fk_flyt_ai_usage_user_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    remaining_tokens: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        server_default="0",
    )
    budget_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "period_start",
            name="uq_flyt_ai_usage_user_period",
        ),
    )


class FlytAiAggregateUsage(BaseModel):
    __tablename__ = "flyt_ai_aggregate_usage"

    provider: Mapped[str] = mapped_column(
        String(K_AI_USAGE_PROVIDER_MAX_LENGTH), nullable=False
    )
    window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    remaining_tokens: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        server_default="0",
    )
    budget_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "window_start",
            name="uq_flyt_ai_aggregate_usage_provider_window",
        ),
    )
