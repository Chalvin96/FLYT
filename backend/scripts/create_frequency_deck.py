#!/usr/bin/env python3
"""Build the frequency deck from Lemma rows that carry ``frequency_rank``.

Idempotent: re-running updates ``CardPool.frequency_rank`` and the DEFINITION
card's ``deck_id`` without duplicating rows. For any ranked lemma still missing
a pool, the shared vocabulary card builder creates the pool **and** its
``DEFINITION`` card. Lemmas without ``primary_translation`` are skipped. Pools
and cards previously tagged to this deck whose lemma lost its rank on a rebuild
are untagged (re-sync).

The rank itself is read from ``Lemma.frequency_rank`` (populated by the lexicon
import). ``CardPool.frequency_rank`` stays the synced copy used by the read
paths; it is overwritten here from the lemma on every build.

Usage:
    python scripts/create_frequency_deck.py
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.deps import build_flashcard_card_service
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Deck
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.lexicons.models import Lemma
from flyt.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)

# Pinned to the existing deck row so find-or-create UPDATES it (a different name
# would orphan every card tagged to the deck via deck_id).
DECK_NAME = "Most Frequent Norwegian Words"
DECK_SOURCE = "Norwegian Kelly List (UiO Text Laboratory)"
DECK_LICENSE = "CC BY-SA 4.0"
DECK_DESCRIPTION = (
    "The most frequent Norwegian (Bokmal) lemmas, ranked by corpus frequency "
    "from the Norwegian Kelly list (UiO Text Laboratory). Each entry points at "
    "the lexicon lemma so reading, definitions, and inflections all reuse "
    "existing machinery."
)
# Kelly has no CEFR tier; the deck's cefr_range stays NULL.
DECK_CEFR_RANGE: str | None = None


async def create_frequency_deck() -> dict[str, int]:
    stats = {"entries_processed": 0, "pools_created": 0, "cards_tagged": 0}

    async with AsyncSessionLocal() as db:
        try:
            flashcard_service = build_flashcard_card_service(db)

            deck = await _sync_deck(db)
            ranked_lemmas = await _ranked_lemmas(db)
            ranked_lemma_ids = await _sync_ranked_lemmas(
                db, flashcard_service, deck, ranked_lemmas, stats
            )
            stale_pools = await _stale_pools(db, deck, ranked_lemma_ids)
            await _clear_stale_pools(db, deck, stale_pools)

            await db.commit()
            logger.info(
                "Import complete: %s entries, %s cards tagged",
                stats["entries_processed"],
                stats["cards_tagged"],
            )
            return stats
        except Exception:
            await db.rollback()
            logger.exception("Failed importing frequency deck")
            raise


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    print("Creating frequency deck from Lemma.frequency_rank...")
    asyncio.run(create_frequency_deck())


async def _sync_deck(db: AsyncSession) -> Deck:
    deck = await db.scalar(select(Deck).where(Deck.name == DECK_NAME))
    if deck is None:
        deck = Deck(
            name=DECK_NAME,
            description=DECK_DESCRIPTION,
            source=DECK_SOURCE,
            license=DECK_LICENSE,
            cefr_range=DECK_CEFR_RANGE,
        )
        db.add(deck)
        await db.flush()
        logger.info("Created deck '%s' (id=%s)", DECK_NAME, deck.id)
    else:
        deck.description = DECK_DESCRIPTION
        deck.source = DECK_SOURCE
        deck.license = DECK_LICENSE
        deck.cefr_range = DECK_CEFR_RANGE
    return deck


async def _ranked_lemmas(db: AsyncSession) -> list[Lemma]:
    return list(
        (
            await db.scalars(
                select(Lemma)
                .where(Lemma.frequency_rank.is_not(None))
                .where(func.trim(Lemma.primary_translation) != "")
                .order_by(Lemma.frequency_rank, Lemma.hgno, Lemma.id)
            )
        ).all()
    )


async def _sync_ranked_lemmas(
    db: AsyncSession,
    flashcard_service: FlashcardCardService,
    deck: Deck,
    ranked_lemmas: list[Lemma],
    stats: dict[str, int],
) -> set[int]:
    ranked_lemma_ids: set[int] = set()
    for lemma in ranked_lemmas:
        ranked_lemma_ids.add(lemma.id)
        pool = await flashcard_service.find_or_create_lemma_pool_with_definition_card(
            lemma
        )
        pool.frequency_rank = lemma.frequency_rank
        if await _tag_definition_card(db, deck.id, pool.id):
            stats["cards_tagged"] += 1
        stats["entries_processed"] += 1
        if stats["entries_processed"] % 500 == 0:
            logger.info(
                "Progress: %s ranked lemmas processed", stats["entries_processed"]
            )
    return ranked_lemma_ids


async def _tag_definition_card(db: AsyncSession, deck_id: int, pool_id: int) -> bool:
    definition_card = await db.scalar(
        select(FlashCard)
        .where(FlashCard.pool_id == pool_id)
        .where(FlashCard.type == CardType.DEFINITION)
        .order_by(FlashCard.id.asc())
        .limit(1)
    )
    if definition_card is None:
        logger.warning(
            "Pool %s has no DEFINITION card after builder; skipping tag", pool_id
        )
        return False
    definition_card.deck_id = deck_id
    return True


async def _stale_pools(
    db: AsyncSession, deck: Deck, ranked_lemma_ids: set[int]
) -> list[CardPool]:
    query = (
        select(CardPool)
        .join(FlashCard, FlashCard.pool_id == CardPool.id)
        .where(FlashCard.deck_id == deck.id)
        .where(CardPool.lemma_id.is_not(None))
    )
    if ranked_lemma_ids:
        query = query.where(~CardPool.lemma_id.in_(ranked_lemma_ids))
    return list((await db.scalars(query)).all())


async def _clear_stale_pools(
    db: AsyncSession, deck: Deck, stale_pools: list[CardPool]
) -> None:
    stale_pool_ids = [pool.id for pool in stale_pools]
    for pool in stale_pools:
        pool.frequency_rank = None
    if not stale_pool_ids:
        return

    stale_cards = (
        await db.scalars(
            select(FlashCard)
            .where(FlashCard.deck_id == deck.id)
            .where(FlashCard.pool_id.in_(stale_pool_ids))
        )
    ).all()
    for card in stale_cards:
        card.deck_id = None
    logger.info(
        "Re-sync: cleared rank/deck tag on %s stale pool(s)", len(stale_pool_ids)
    )


if __name__ == "__main__":
    main()
