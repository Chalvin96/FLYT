"""Unify Flyt Chatbot usage accounting with debit-only token stock."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "944bb9a5ca8b"
down_revision: str | Sequence[str] | None = "32c8dd3ba435"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table(
        "assistant_openrouter_credentials", "chatbot_openrouter_credentials"
    )
    op.execute(
        sa.text(
            "ALTER INDEX ix_assistant_openrouter_credentials_user_id "
            "RENAME TO ix_chatbot_openrouter_credentials_user_id"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE chatbot_openrouter_credentials "
            "RENAME CONSTRAINT fk_assistant_openrouter_credentials_user_id "
            "TO fk_chatbot_openrouter_credentials_user_id"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE chatbot_openrouter_credentials "
            "RENAME CONSTRAINT assistant_openrouter_credentials_pkey "
            "TO chatbot_openrouter_credentials_pkey"
        )
    )
    op.execute(
        sa.text(
            "ALTER SEQUENCE IF EXISTS assistant_openrouter_credentials_id_seq "
            "RENAME TO chatbot_openrouter_credentials_id_seq"
        )
    )

    op.create_table(
        "flyt_ai_usage",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column(
            "remaining_tokens", sa.BigInteger(), server_default="0", nullable=False
        ),
        sa.Column("budget_tokens", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_users.id"],
            name="fk_flyt_ai_usage_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "period_start", name="uq_flyt_ai_usage_user_period"
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO flyt_ai_usage "
            "(user_id, period_start, remaining_tokens, budget_tokens) "
            "SELECT user_id, period_start, "
            "GREATEST(100000 - LEAST(message_count * 2000, 100000), 0), "
            "100000 FROM assistant_usage"
        )
    )
    op.drop_table("assistant_usage")

    op.create_table(
        "flyt_ai_aggregate_usage",
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column(
            "remaining_tokens", sa.BigInteger(), server_default="0", nullable=False
        ),
        sa.Column("budget_tokens", sa.BigInteger(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "window_start",
            name="uq_flyt_ai_aggregate_usage_provider_window",
        ),
    )


def downgrade() -> None:
    op.drop_table("flyt_ai_aggregate_usage")

    op.create_table(
        "assistant_usage",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("message_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_users.id"],
            name="fk_assistant_usage_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "period_start", name="uq_assistant_usage_user_period"
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO assistant_usage (user_id, period_start, message_count) "
            "SELECT user_id, period_start, "
            "CEIL((budget_tokens - remaining_tokens) / 2000.0)::integer "
            "FROM flyt_ai_usage"
        )
    )
    op.drop_table("flyt_ai_usage")

    op.execute(
        sa.text(
            "ALTER SEQUENCE IF EXISTS chatbot_openrouter_credentials_id_seq "
            "RENAME TO assistant_openrouter_credentials_id_seq"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE chatbot_openrouter_credentials "
            "RENAME CONSTRAINT chatbot_openrouter_credentials_pkey "
            "TO assistant_openrouter_credentials_pkey"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE chatbot_openrouter_credentials "
            "RENAME CONSTRAINT fk_chatbot_openrouter_credentials_user_id "
            "TO fk_assistant_openrouter_credentials_user_id"
        )
    )
    op.execute(
        sa.text(
            "ALTER INDEX ix_chatbot_openrouter_credentials_user_id "
            "RENAME TO ix_assistant_openrouter_credentials_user_id"
        )
    )
    op.rename_table(
        "chatbot_openrouter_credentials", "assistant_openrouter_credentials"
    )
