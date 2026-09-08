"""Graded versus ungraded review outcome behavior."""

from datetime import timedelta

from fsrs import Rating
import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.exceptions import InvalidReviewOutcomeError
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.services import UserLemmaService
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


def build_service(db: AsyncSession) -> FlashcardReviewService:
    return FlashcardReviewService(
        db,
        StatsService(db, query_service=StatsQueryService(db)),
        UserLemmaService(db),
        FlashcardCardService(db, UserLemmaService(db)),
    )


async def test_submit_review_given_graded_outcome_expect_fsrs_and_log(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.CHOOSE,
        schema_version="4.0",
        payload_json={
            "kind": "exercise",
            "id": "ex-1",
            "operation": "choose",
            "prompt": [{"kind": "text", "value": "p"}],
            "explanation": None,
            "payload": {"options": [], "answer_id": "a"},
        },
    )
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        last_shown_card=card,
        active_card=card,
        due_at=now() - timedelta(days=1),
    )

    reviewed, scheduled = await build_service(db).submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="graded",
        rating=Rating.Good,
    )

    assert scheduled is True
    assert reviewed.state != CardState.NEW
    logs = (await db.scalars(select(StatsReviewLog))).all()
    assert len(logs) == 1
    assert logs[0].rating == Rating.Good


async def test_submit_review_given_skipped_outcome_expect_resolved_rotation_without_scheduling(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.SPEAK,
        schema_version="4.0",
        payload_json={
            "kind": "exercise",
            "id": "ex-speak",
            "operation": "speak",
            "prompt": [{"kind": "text", "value": "p"}],
            "explanation": None,
            "payload": {"target": "Jeg jobber."},
        },
    )
    due_at = now() - timedelta(days=1)
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        active_card=card,
        due_at=due_at,
    )

    reviewed, scheduled = await build_service(db).submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="skipped",
        rating=None,
    )

    assert scheduled is False
    assert reviewed.state == CardState.NEW
    assert reviewed.due_at == due_at
    assert reviewed.last_review_at is None
    assert reviewed.last_shown_card_id == card.id
    assert reviewed.active_card_id is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


async def test_submit_review_given_service_unavailable_outcome_expect_resolved_rotation_without_scheduling(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.WRITE,
        schema_version="4.0",
        payload_json={
            "kind": "exercise",
            "id": "ex-write",
            "operation": "write",
            "prompt": [{"kind": "text", "value": "p"}],
            "explanation": None,
            "payload": {
                "response_language": "no",
                "min_words": 5,
                "max_words": 40,
                "judge_prompt": "Judge.",
                "criteria": [{"id": "c", "instruction": "ok"}],
            },
        },
    )
    user_card = await UserCardFactory.create(user=user, pool=pool, active_card=card)

    reviewed, scheduled = await build_service(db).submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="service_unavailable",
        rating=None,
    )

    assert scheduled is False
    assert reviewed.fsrs_stability is None
    assert reviewed.last_shown_card_id == card.id
    assert reviewed.active_card_id is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


async def test_submit_review_given_ungraded_choose_outcome_expect_invalid(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.CHOOSE,
        schema_version="4.0",
        payload_json={
            "kind": "exercise",
            "id": "ex-choose",
            "operation": "choose",
            "prompt": [{"kind": "text", "value": "p"}],
            "explanation": None,
            "payload": {"options": [], "answer_id": "a"},
        },
    )
    user_card = await UserCardFactory.create(
        user=user, pool=pool, last_shown_card=card, active_card=card
    )

    with pytest.raises(InvalidReviewOutcomeError):
        await build_service(db).submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=card.id,
            outcome="service_unavailable",
            rating=None,
        )

    assert user_card.last_shown_card_id == card.id
    assert user_card.active_card_id == card.id
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


async def test_submit_review_given_ungraded_sibling_variant_expect_not_found(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    shown = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.CHOOSE,
        schema_version="4.0",
        payload_json={},
    )
    sibling = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.WRITE,
        schema_version="4.0",
        payload_json={},
    )
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        last_shown_card=shown,
        active_card=shown,
    )

    with pytest.raises(CardNotFoundError):
        await build_service(db).submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=sibling.id,
            outcome="service_unavailable",
            rating=None,
        )

    assert user_card.last_shown_card_id == shown.id
    assert user_card.active_card_id == shown.id
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


async def test_submit_review_given_graded_without_rating_expect_invalid(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(
        user=user, pool=pool, last_shown_card=card, active_card=card
    )

    from flyt.apps.flashcards.exceptions import InvalidReviewRatingError

    with pytest.raises(InvalidReviewRatingError):
        await build_service(db).submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=card.id,
            outcome="graded",
            rating=None,
        )
