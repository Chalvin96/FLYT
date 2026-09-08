"""cascade review logs from user cards

Revision ID: 7c3477c1d5a2
Revises: 6586d79553b2
Create Date: 2026-07-25 21:10:22.434602

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7c3477c1d5a2"
down_revision: Union[str, Sequence[str], None] = "6586d79553b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = "stats_review_logs_user_card_id_fkey"


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("stats_review_logs", schema=None) as batch_op:
        batch_op.drop_constraint(FK_NAME, type_="foreignkey")
        batch_op.create_foreign_key(
            FK_NAME,
            "flashcard_user_cards",
            ["user_card_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("stats_review_logs", schema=None) as batch_op:
        batch_op.drop_constraint(FK_NAME, type_="foreignkey")
        batch_op.create_foreign_key(
            FK_NAME, "flashcard_user_cards", ["user_card_id"], ["id"]
        )
