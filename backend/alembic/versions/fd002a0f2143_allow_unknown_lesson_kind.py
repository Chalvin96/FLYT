"""allow unknown lesson kind

Revision ID: fd002a0f2143
Revises: 49b50a4fb0f4
Create Date: 2026-10-18 21:08:31.967168

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "fd002a0f2143"
down_revision: str | Sequence[str] | None = "49b50a4fb0f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("lesson_lessons", schema=None) as batch_op:
        batch_op.alter_column("kind", existing_type=sa.VARCHAR(), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("lesson_lessons", schema=None) as batch_op:
        batch_op.alter_column("kind", existing_type=sa.VARCHAR(), nullable=False)
