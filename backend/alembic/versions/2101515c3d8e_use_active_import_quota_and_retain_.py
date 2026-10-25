"""Use active import quota and retain generated titles

Revision ID: 2101515c3d8e
Revises: 49b50a4fb0f4
Create Date: 2026-10-18 21:38:27.253207

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "2101515c3d8e"
down_revision: str | Sequence[str] | None = "49b50a4fb0f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("story_import_quota", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_story_import_quota_user_id"))

    op.drop_table("story_import_quota")
    with op.batch_alter_table("story_generation_generations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("title", sa.String(length=200), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("story_generation_generations", schema=None) as batch_op:
        batch_op.drop_column("title")

    op.create_table(
        "story_import_quota",
        sa.Column("user_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "used",
            sa.INTEGER(),
            server_default=sa.text("0"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("id", sa.INTEGER(), autoincrement=True, nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user_users.id"],
            name=op.f("fk_story_import_quota_user_id"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("story_import_quota_pkey")),
    )
    with op.batch_alter_table("story_import_quota", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_story_import_quota_user_id"), ["user_id"], unique=True
        )
