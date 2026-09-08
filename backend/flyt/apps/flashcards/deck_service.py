"""Shared-deck subscription and learner deck summaries."""

from dataclasses import dataclass

from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.card_service import EnrollmentShape
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.exceptions import DeckNotFoundError
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Deck
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.users.services import UserLemmaService


@dataclass(frozen=True)
class DeckSummary:
    id: int
    name: str
    description: str | None
    card_count: int
    cefr_range: str | None
    is_subscribed: bool
    studied_count: int


class FlashcardDeckService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def subscribe_to_deck(self, user_id: int, deck_id: int) -> None:
        deck = await self.db.get(Deck, deck_id)
        if not deck:
            raise DeckNotFoundError()

        pool_ids = {
            pool_id
            for pool_id in (
                await self.db.scalars(
                    select(FlashCard.pool_id)
                    .where(FlashCard.deck_id == deck_id)
                    .where(FlashCard.is_addable.is_(True))
                    .where(FlashCard.pool_id.is_not(None))
                    .distinct()
                )
            ).all()
            if pool_id is not None
        }
        await FlashcardCardService(self.db, UserLemmaService(self.db)).enroll_pools(
            user_id,
            sorted(pool_ids),
            shape=EnrollmentShape.ENQUEUE_UPCOMING,
        )

    async def list_decks(self, user_id: int) -> list[DeckSummary]:
        """Return available shared decks with per-user subscription/progress info."""
        deck_ids_rows = (
            await self.db.scalars(select(Deck.id).order_by(Deck.id.asc()))
        ).all()
        if not deck_ids_rows:
            return []

        deck_ids = list(deck_ids_rows)

        # Card-side aggregates (counts + distinct addable pools) in one pass.
        card_rows = (
            await self.db.execute(
                select(
                    FlashCard.deck_id,
                    func.count(
                        case((FlashCard.is_addable.is_(True), FlashCard.id))
                    ).label("card_count"),
                    func.count(
                        func.distinct(
                            case(
                                (
                                    FlashCard.is_addable.is_(True)
                                    & FlashCard.pool_id.is_not(None),
                                    FlashCard.pool_id,
                                )
                            )
                        )
                    ).label("pool_count"),
                )
                .where(FlashCard.deck_id.in_(deck_ids))
                .group_by(FlashCard.deck_id)
            )
        ).all()
        card_counts = {r.deck_id: r.card_count for r in card_rows}
        deck_pool_counts = {r.deck_id: r.pool_count for r in card_rows}

        # User-side aggregates (studied + owned addable pools) in one pass.
        user_rows = (
            await self.db.execute(
                select(
                    FlashCard.deck_id,
                    func.count(
                        func.distinct(
                            case((UserCard.state != CardState.NEW, UserCard.id))
                        )
                    ).label("studied"),
                    func.count(
                        func.distinct(
                            case(
                                (
                                    FlashCard.is_addable.is_(True)
                                    & FlashCard.pool_id.is_not(None),
                                    UserCard.pool_id,
                                )
                            )
                        )
                    ).label("owned_pools"),
                )
                .join(FlashCard, FlashCard.pool_id == UserCard.pool_id)
                .where(FlashCard.deck_id.in_(deck_ids))
                .where(UserCard.user_id == user_id)
                .group_by(FlashCard.deck_id)
            )
        ).all()
        user_studied = {r.deck_id: r.studied for r in user_rows}
        user_owned_pool_counts = {r.deck_id: r.owned_pools for r in user_rows}

        # Column select: avoid the Deck.cards lazy="selectin" cascade that pulls
        # every FlashCard (and their pools/lemmas) just to read four columns.
        deck_rows = (
            await self.db.execute(
                select(Deck.id, Deck.name, Deck.description, Deck.cefr_range).where(
                    Deck.id.in_(deck_ids)
                )
            )
        ).all()
        deck_by_id = {r.id: r for r in deck_rows}

        result: list[DeckSummary] = []
        for deck_id in deck_ids:
            deck = deck_by_id.get(deck_id)
            if deck is None:
                continue
            deck_addable_pool_count = deck_pool_counts.get(deck_id, 0)
            result.append(
                DeckSummary(
                    id=deck.id,
                    name=deck.name,
                    description=deck.description,
                    card_count=card_counts.get(deck_id, 0),
                    cefr_range=deck.cefr_range,
                    is_subscribed=deck_addable_pool_count > 0
                    and user_owned_pool_counts.get(deck_id, 0)
                    >= deck_addable_pool_count,
                    studied_count=user_studied.get(deck_id, 0),
                )
            )
        return result
