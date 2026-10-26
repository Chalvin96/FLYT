"""cascade lesson progress on lesson delete

Revision ID: 49b50a4fb0f4
Revises: 13942d5fff43
Create Date: 2026-10-03 17:03:46.472157

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "49b50a4fb0f4"
down_revision: str | Sequence[str] | None = "13942d5fff43"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("lesson_user_progress", schema=None) as batch_op:
        batch_op.drop_constraint(
            batch_op.f("lesson_user_progress_lesson_id_fkey"), type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "lesson_user_progress_lesson_id_fkey",
            "lesson_lessons",
            ["lesson_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("lesson_user_progress", schema=None) as batch_op:
        batch_op.drop_constraint(
            "lesson_user_progress_lesson_id_fkey", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            batch_op.f("lesson_user_progress_lesson_id_fkey"),
            "lesson_lessons",
            ["lesson_id"],
            ["id"],
        )
