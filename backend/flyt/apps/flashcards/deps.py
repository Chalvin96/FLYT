from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.deck_service import FlashcardDeckService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.flashcards.user_cards_service import MyCardsService
from flyt.apps.stats.deps import get_stats_service
from flyt.apps.stats.services import StatsService
from flyt.apps.users.deps import get_user_lemma_service
from flyt.apps.users.services import UserLemmaService
from flyt.core.db import get_async_db


def build_flashcard_card_service(db: AsyncSession) -> FlashcardCardService:
    return FlashcardCardService(
        db,
        user_lemma_service=UserLemmaService(db),
    )


def get_flashcard_card_service(
    db: AsyncSession = Depends(get_async_db),
    user_lemma_service: UserLemmaService = Depends(get_user_lemma_service),
) -> FlashcardCardService:
    return FlashcardCardService(
        db,
        user_lemma_service=user_lemma_service,
    )


def get_flashcard_review_service(
    db: AsyncSession = Depends(get_async_db),
    stats_service: StatsService = Depends(get_stats_service),
    user_lemma_service: UserLemmaService = Depends(get_user_lemma_service),
    card_service: FlashcardCardService = Depends(get_flashcard_card_service),
) -> FlashcardReviewService:
    return FlashcardReviewService(
        db,
        stats_service=stats_service,
        user_lemma_service=user_lemma_service,
        card_service=card_service,
    )


def get_my_cards_service(
    db: AsyncSession = Depends(get_async_db),
) -> MyCardsService:
    return MyCardsService(db)


def get_flashcard_deck_service(
    db: AsyncSession = Depends(get_async_db),
) -> FlashcardDeckService:
    return FlashcardDeckService(db)
