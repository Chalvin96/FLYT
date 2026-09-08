"""E2E-ONLY: assign deterministic ``frequency_rank`` values to imported lemmas.

The committed e2e lexicon fixture does not carry corpus frequency data, so
``Lemma.frequency_rank`` is NULL for every row after ``import_lexicon.py``.
Story-generation target selection draws exclusively from the frequency deck
(lemmas with a non-null ``frequency_rank``), so without ranked lemmas every
generation request is refused with ``ANCHOR_NOTHING_TO_TEACH`` — including
the no-anchor path, whose targets still come from the frequency deck.

This restores just enough frequency data for the recorded story-generation
walkthrough to exercise the real provider. It sets a deterministic rank on
every imported lemma (ordered by id), idempotently. It touches data only, not
feature code, and never builds the flashcard frequency deck.

Usage (inside the e2e-backend container)::

    python scripts/seed_e2e_frequency_ranks.py
"""

import asyncio

from sqlalchemy import select
from sqlalchemy import update

from flyt.apps.lexicons.models import Lemma
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal


def assert_e2e_environment() -> None:
    if settings.ENV != "e2e":
        msg = "E2E frequency-rank seed may only run with ENV=e2e"
        raise RuntimeError(msg)
    if "flyt_e2e" not in settings.DATABASE_URL:
        msg = "E2E frequency-rank seed expected DATABASE_URL to point at flyt_e2e"
        raise RuntimeError(msg)


async def seed_e2e_frequency_ranks() -> int:
    assert_e2e_environment()
    async with AsyncSessionLocal() as db:
        ids = (
            (await db.execute(select(Lemma.id).order_by(Lemma.id.asc())))
            .scalars()
            .all()
        )
        for rank, lemma_id in enumerate(ids, start=1):
            await db.execute(
                update(Lemma).where(Lemma.id == lemma_id).values(frequency_rank=rank)
            )
        await db.commit()
    return len(ids)


async def main() -> None:
    count = await seed_e2e_frequency_ranks()
    print(f"Assigned deterministic frequency_rank to {count} lemmas.")


if __name__ == "__main__":
    asyncio.run(main())
