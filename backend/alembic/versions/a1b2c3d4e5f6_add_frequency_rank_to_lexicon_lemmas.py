"""add frequency_rank and frequency_ambiguous to lexicon_lemmas

Revision ID: a1b2c3d4e5f6
Revises: 4004e0af8815
Create Date: 2026-07-04 14:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "4004e0af8815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("lexicon_lemmas", schema=None) as batch_op:
        batch_op.add_column(sa.Column("frequency_rank", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "frequency_ambiguous",
                sa.Boolean(),
                server_default="false",
                nullable=False,
            )
        )
        batch_op.create_index(
            batch_op.f("ix_lexicon_lemmas_frequency_rank"),
            ["frequency_rank"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("lexicon_lemmas", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_lexicon_lemmas_frequency_rank"))
        batch_op.drop_column("frequency_ambiguous")
        batch_op.drop_column("frequency_rank")
