"""merge lesson kind and import quota heads

Revision ID: e524a6fe9cbb
Revises: 2101515c3d8e, fd002a0f2143
Create Date: 2026-10-19 21:24:03.471561

"""

from collections.abc import Sequence


# revision identifiers, used by Alembic.
revision: str = "e524a6fe9cbb"
down_revision: str | Sequence[str] | None = ("2101515c3d8e", "fd002a0f2143")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
