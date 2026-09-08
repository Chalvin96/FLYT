import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.constants import K_MY_CARDS_DEFAULT_PAGE_SIZE
from flyt.apps.flashcards.constants import K_REVIEW_MODE_FULL
from flyt.apps.flashcards.constants import ReviewMode
from flyt.apps.flashcards.deps import get_flashcard_card_service
from flyt.apps.flashcards.deps import get_flashcard_deck_service
from flyt.apps.flashcards.deps import get_flashcard_review_service
from flyt.apps.flashcards.deps import get_my_cards_service
from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.exceptions import DeckNotFoundError
from flyt.apps.flashcards.exceptions import InvalidReviewOutcomeError
from flyt.apps.flashcards.exceptions import InvalidReviewRatingError
from flyt.apps.flashcards.exceptions import LemmaNotDeckableError
from flyt.apps.flashcards.schemas import AddMoreNewResponse
from flyt.apps.flashcards.schemas import DeckSummaryItem
from flyt.apps.flashcards.schemas import LemmaContextCreate
from flyt.apps.flashcards.schemas import MyCardItem
from flyt.apps.flashcards.schemas import MyCardsResponse
from flyt.apps.flashcards.schemas import MyCardsSummary
from flyt.apps.flashcards.schemas import ReviewResult
from flyt.apps.flashcards.schemas import ReviewSubmission
from flyt.apps.flashcards.schemas import UserCardRead
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.deck_service import FlashcardDeckService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.flashcards.user_cards_service import MyCardsService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.exceptions import ConflictError
from flyt.core.http import EmptyResponse
from flyt.core.http import error_response

logger = logging.getLogger(__name__)


user_cards_router = APIRouter(prefix="/me/cards", tags=["flashcards"])
user_deck_router = APIRouter(prefix="/me/decks", tags=["flashcards"])


@user_cards_router.get("")
async def list_my_cards(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[MyCardsService, Depends(get_my_cards_service)],
    facet: Annotated[str, Query(pattern="^(all|vocab|grammar)$")] = "all",
    bucket: Annotated[
        str | None, Query(pattern="^(not_started|learning|familiar|known|mastered)$")
    ] = None,
    started_only: Annotated[bool, Query()] = True,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: Annotated[str, Query(pattern="^(weakest|recent|alpha)$")] = "weakest",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = K_MY_CARDS_DEFAULT_PAGE_SIZE,
) -> MyCardsResponse:
    logger.info(
        "[flashcards.list_my_cards] entering with params user_id=%s facet=%s bucket=%s started_only=%s q=%s sort=%s page=%s limit=%s",
        current_user.id,
        facet,
        bucket,
        started_only,
        q,
        sort,
        page,
        limit,
    )
    result = await service.list_user_cards(
        user_id=current_user.id,
        facet=facet,
        bucket=bucket,
        started_only=started_only,
        q=q,
        sort=sort,
        page=page,
        limit=limit,
    )
    response = MyCardsResponse(
        cards=[
            MyCardItem(
                user_card_id=c.user_card_id,
                facet=c.facet,  # type: ignore[arg-type]
                label=c.label,
                subtitle=c.subtitle,
                bucket=c.bucket,  # type: ignore[arg-type]
                lemma_uuid=c.lemma_uuid,
                lesson_id=c.lesson_id,
                lesson_title=c.lesson_title,
            )
            for c in result.cards
        ],
        summary=MyCardsSummary(
            total=result.total,
            counts_by_bucket=result.counts_by_bucket,  # type: ignore[arg-type]
        ),
        page=result.page,
        limit=result.limit,
        has_more=result.has_more,
    )
    logger.info(
        "[flashcards.list_my_cards] exiting with params user_id=%s total=%s returned=%s has_more=%s status_code=%s",
        current_user.id,
        result.total,
        len(response.cards),
        result.has_more,
        status.HTTP_200_OK,
    )
    return response


@user_cards_router.get("/due")
async def issue_due_cards(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardReviewService, Depends(get_flashcard_review_service)],
    mode: ReviewMode = K_REVIEW_MODE_FULL,
) -> list[UserCardRead]:
    logger.info(
        "[flashcards.issue_due_cards] entering with params user_id=%s",
        current_user.id,
    )
    due_cards = await service.issue_due_cards(user_id=current_user.id, mode=mode)
    # Persist read-path promotions and the issued variant used by review.
    await db.commit()
    result = [UserCardRead.from_due_card(dc) for dc in due_cards]
    logger.info(
        "[flashcards.issue_due_cards] exiting with params user_id=%s mode=%s count=%s status_code=%s",
        current_user.id,
        mode,
        len(result),
        status.HTTP_200_OK,
    )
    return result


@user_cards_router.post("/{user_card_id}/review")
async def review_card(
    user_card_id: int,
    payload: ReviewSubmission,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardReviewService, Depends(get_flashcard_review_service)],
) -> ReviewResult:
    logger.info(
        "[flashcards.review_card] entering with params user_id=%s user_card_id=%s outcome=%s",
        current_user.id,
        user_card_id,
        payload.outcome,
    )
    try:
        user_card, _scheduled = await service.submit_review(
            user_id=current_user.id,
            user_card_id=user_card_id,
            card_id=payload.card_id,
            outcome=payload.outcome,
            rating=payload.rating,
        )
        await db.commit()
        counts = await service.count_due_states(user_id=current_user.id)
        logger.info(
            "[flashcards.review_card] exiting with params user_id=%s user_card_id=%s status_code=%s",
            current_user.id,
            user_card_id,
            status.HTTP_200_OK,
        )
        return ReviewResult(
            new_remaining=counts.new,
            learning_remaining=counts.learning,
            review_remaining=counts.review,
            card_state=user_card.state,
            due_at=user_card.due_at,
        )
    except CardNotFoundError as error:
        logger.info(
            "[flashcards.review_card] exiting with params user_id=%s user_card_id=%s error_code=%s status_code=%s",
            current_user.id,
            user_card_id,
            error.code,
            status.HTTP_404_NOT_FOUND,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except InvalidReviewRatingError as error:
        logger.info(
            "[flashcards.review_card] exiting with params user_id=%s user_card_id=%s error_code=%s status_code=%s",
            current_user.id,
            user_card_id,
            error.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(error.code, error.message),
        ) from error
    except InvalidReviewOutcomeError as error:
        logger.info(
            "[flashcards.review_card] exiting with params user_id=%s user_card_id=%s error_code=%s status_code=%s",
            current_user.id,
            user_card_id,
            error.code,
            status.HTTP_400_BAD_REQUEST,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response(error.code, error.message),
        ) from error


@user_cards_router.post(
    "/lemmas/{lemma_uuid}/add-to-deck",
)
async def add_lemma_to_deck(
    lemma_uuid: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardCardService, Depends(get_flashcard_card_service)],
    context: LemmaContextCreate | None = None,
) -> EmptyResponse:
    try:
        await service.add_lemma_to_deck(
            current_user.id,
            lemma_uuid,
            context=context,
        )
        await db.commit()
        return EmptyResponse()
    except LemmaNotDeckableError as error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ConflictError as error:
        await db.rollback()
        raise HTTPException(
            status_code=error.status_code,
            detail=error_response(error.code, error.message),
        ) from error
    except Exception:
        await db.rollback()
        raise


@user_deck_router.get("")
async def list_decks(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardDeckService, Depends(get_flashcard_deck_service)],
) -> list[DeckSummaryItem]:
    decks = await service.list_decks(user_id=current_user.id)
    return [
        DeckSummaryItem(
            id=d.id,
            name=d.name,
            description=d.description,
            card_count=d.card_count,
            cefr_range=d.cefr_range,
            is_subscribed=d.is_subscribed,
            studied_count=d.studied_count,
        )
        for d in decks
    ]


@user_deck_router.post("/{deck_id}/subscribe")
async def subscribe_to_deck(
    deck_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardDeckService, Depends(get_flashcard_deck_service)],
) -> EmptyResponse:
    logger.info(
        "[flashcards.subscribe_to_deck] entering with params user_id=%s deck_id=%s",
        current_user.id,
        deck_id,
    )
    try:
        await service.subscribe_to_deck(user_id=current_user.id, deck_id=deck_id)
        await db.commit()
        logger.info(
            "[flashcards.subscribe_to_deck] exiting with params user_id=%s deck_id=%s status_code=%s",
            current_user.id,
            deck_id,
            status.HTTP_200_OK,
        )
        return EmptyResponse()
    except DeckNotFoundError as error:
        logger.info(
            "[flashcards.subscribe_to_deck] exiting with params user_id=%s deck_id=%s error_code=%s status_code=%s",
            current_user.id,
            deck_id,
            error.code,
            status.HTTP_404_NOT_FOUND,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error


@user_cards_router.post(
    "/add-more-new",
)
async def add_more_new(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[FlashcardReviewService, Depends(get_flashcard_review_service)],
) -> AddMoreNewResponse:
    """Promote a capped batch of UPCOMING cards to ACTIVE/NEW.

    Explicit learner action ("add more new words") that surfaces additional
    new cards in the live due set immediately.
    """
    logger.info(
        "[flashcards.add_more_new] entering with params user_id=%s",
        current_user.id,
    )
    promoted = await service.add_more_new(user_id=current_user.id)
    await db.commit()
    logger.info(
        "[flashcards.add_more_new] exiting with params user_id=%s promoted=%s",
        current_user.id,
        promoted,
    )
    return AddMoreNewResponse(promoted=promoted)
