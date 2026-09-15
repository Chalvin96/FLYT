"""Store story generation request state and results in PostgreSQL.

Revision ID: 13942d5fff43
Revises: b2a721b94207
Create Date: 2026-09-14 19:04:01.343568

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "13942d5fff43"
down_revision: str | Sequence[str] | None = "b2a721b94207"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the request and result columns."""
    with op.batch_alter_table("story_generation_generations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("topic", sa.String(length=200), nullable=True))
        batch_op.add_column(
            sa.Column(
                "provider", sa.String(length=32), server_default="", nullable=False
            )
        )
        batch_op.add_column(
            sa.Column(
                "worker_claim",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            )
        )
        batch_op.add_column(sa.Column("text", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("pages", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove the request and result columns."""
    with op.batch_alter_table("story_generation_generations", schema=None) as batch_op:
        batch_op.drop_column("pages")
        batch_op.drop_column("text")
        batch_op.drop_column("worker_claim")
        batch_op.drop_column("provider")
        batch_op.drop_column("topic")
