"""index ready public stories by group and recency

Revision ID: 0fc79739740d
Revises: e524a6fe9cbb
Create Date: 2026-10-22 05:11:01.636932

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0fc79739740d"
down_revision: str | Sequence[str] | None = "e524a6fe9cbb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("reading_stories", schema=None) as batch_op:
        batch_op.create_index(
            "ix_reading_stories_public_group_created_id",
            ["reading_group_id", "created_at", "id"],
            unique=False,
            postgresql_where=sa.text("visibility = 'public' AND is_ready IS true"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("reading_stories", schema=None) as batch_op:
        batch_op.drop_index(
            "ix_reading_stories_public_group_created_id",
            postgresql_where=sa.text("visibility = 'public' AND is_ready IS true"),
        )
