"""lexicon_lemmas identity: (source_article_id, source_lemma_id)

Replace the unique constraint (source_article_id, word, pos, hgno) — which is
NOT unique across distinct senses and silently dropped real lemmas — with the
actual identity (source_article_id, source_lemma_id).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_UQ = "lexicon_lemmas_source_article_id_word_pos_hgno_key"
NEW_UQ = "uq_lemma_article_source_id"


def upgrade() -> None:
    with op.batch_alter_table("lexicon_lemmas") as batch_op:
        batch_op.drop_constraint(OLD_UQ, type_="unique")
        batch_op.create_unique_constraint(
            NEW_UQ, ["source_article_id", "source_lemma_id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("lexicon_lemmas") as batch_op:
        batch_op.drop_constraint(NEW_UQ, type_="unique")
        batch_op.create_unique_constraint(
            OLD_UQ, ["source_article_id", "word", "pos", "hgno"]
        )
