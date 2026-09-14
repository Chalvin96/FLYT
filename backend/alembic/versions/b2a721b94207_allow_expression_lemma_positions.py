"""allow expression lemma positions

Revision ID: b2a721b94207
Revises: e1c0ffa70688
Create Date: 2026-09-13 10:10:15.818853

"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b2a721b94207"
down_revision: str | Sequence[str] | None = "e1c0ffa70688"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("lemmapos", "lexicon_lemmas", type_="check")
    op.create_check_constraint(
        "lemmapos",
        "lexicon_lemmas",
        "pos IN ('noun', 'adjective', 'verb', 'adverb', 'preposition', "
        "'conjunction', 'pronoun', 'determiner', 'interjection', 'numeral', "
        "'expression', 'unknown')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("lemmapos", "lexicon_lemmas", type_="check")
    op.create_check_constraint(
        "lemmapos",
        "lexicon_lemmas",
        "pos IN ('noun', 'adjective', 'verb', 'adverb', 'preposition', "
        "'conjunction', 'pronoun', 'determiner', 'interjection', 'numeral', "
        "'unknown')",
    )
