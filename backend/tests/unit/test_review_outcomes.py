"""Graded versus ungraded review outcome behavior."""

from datetime import timedelta

from fsrs import Rating
from pydantic import ValidationError
import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.exceptions import CardNotFoundError
from flyt.apps.flashcards.exceptions import InvalidReviewOutcomeError
from flyt.apps.flashcards.exceptions import StaleReviewError
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.flashcards.schemas import ReviewSubmission
from flyt.apps.users.services import UserLemmaService
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio
EXPECTED_SESSION_REVIEW_COUNT = 2


def build_service(db: AsyncSession) -> FlashcardReviewService:
    return FlashcardReviewService(
        db,
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
        review_version=0,
    )

    assert scheduled is True
    assert reviewed.state != CardState.NEW
    assert reviewed.review_version == 1
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
        review_version=0,
    )

    assert scheduled is False
    assert reviewed.review_version == 1
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
        review_version=0,
    )

    assert scheduled is False
    assert reviewed.review_version == 1
    assert reviewed.fsrs_stability is None
    assert reviewed.last_shown_card_id == card.id
    assert reviewed.active_card_id is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


@pytest.mark.parametrize(
    ("card_type", "schema_version"),
    [(CardType.CHOOSE, "4.0"), (CardType.BUILD, "unsupported")],
)
async def test_submit_review_given_unsupported_card_expect_resolved_without_scheduling(
    db: AsyncSession, card_type: CardType, schema_version: str
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=card_type,
        schema_version=schema_version,
        payload_json={},
    )
    due_at = now() - timedelta(days=1)
    last_review_at = now() - timedelta(days=2)
    stability = 10.0
    difficulty = 5.0
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        active_card=card,
        state=CardState.REVIEW,
        due_at=due_at,
        last_review_at=last_review_at,
        fsrs_stability=stability,
        fsrs_difficulty=difficulty,
        fsrs_step=1,
    )

    reviewed, scheduled = await build_service(db).submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="unsupported",
        rating=None,
        review_version=0,
    )

    assert scheduled is False
    assert reviewed.review_version == 1
    assert reviewed.state == CardState.REVIEW
    assert reviewed.due_at == due_at
    assert reviewed.last_review_at == last_review_at
    assert reviewed.fsrs_stability == pytest.approx(stability)
    assert reviewed.fsrs_difficulty == pytest.approx(difficulty)
    assert reviewed.fsrs_step == 1
    assert reviewed.last_shown_card_id == card.id
    assert reviewed.active_card_id is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


def test_review_submission_given_unsupported_with_rating_expect_invalid() -> None:
    with pytest.raises(
        ValidationError, match="ungraded outcome must not carry a rating"
    ):
        ReviewSubmission(card_id=1, outcome="unsupported", rating=3, review_version=0)


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
            review_version=0,
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
            review_version=0,
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
            review_version=0,
        )


async def test_submit_review_given_learning_step_repeat_without_reissue_expect_scheduled(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(
        user=user, pool=pool, last_shown_card=card, active_card=card
    )
    service = build_service(db)

    reviewed, _ = await service.submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="graded",
        rating=Rating.Again,
        review_version=0,
    )
    _, scheduled = await service.submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome="graded",
        rating=Rating.Good,
        review_version=reviewed.review_version,
    )

    assert scheduled is True
    assert reviewed.review_version == EXPECTED_SESSION_REVIEW_COUNT
    assert (
        await db.scalar(select(func.count(StatsReviewLog.id)))
    ) == EXPECTED_SESSION_REVIEW_COUNT


async def test_submit_review_given_sibling_variant_after_graded_review_expect_not_found(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    shown = await FlashCardFactory.create(pool=pool, is_addable=True)
    sibling = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(
        user=user, pool=pool, last_shown_card=shown, active_card=shown
    )
    service = build_service(db)
    reviewed, _ = await service.submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=shown.id,
        outcome="graded",
        rating=Rating.Again,
        review_version=0,
    )

    with pytest.raises(CardNotFoundError):
        await service.submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=sibling.id,
            outcome="graded",
            rating=Rating.Good,
            review_version=reviewed.review_version,
        )


@pytest.mark.parametrize(
    "outcome", ["graded", "skipped", "service_unavailable", "unsupported"]
)
@pytest.mark.parametrize("submitted_version", [4, 6])
async def test_submit_review_given_mismatched_version_expect_stale_without_changes(
    db: AsyncSession, outcome: str, submitted_version: int
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool, type=CardType.WRITE, payload_json={}
    )
    initial_version = 5
    user_card = await UserCardFactory.create(
        user=user, pool=pool, active_card=card, review_version=initial_version
    )
    due_at = user_card.due_at

    with pytest.raises(StaleReviewError):
        await build_service(db).submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=card.id,
            outcome=outcome,
            rating=Rating.Again if outcome == "graded" else None,
            review_version=submitted_version,
        )

    await db.flush()
    db.expunge_all()
    reloaded = await db.get(UserCard, user_card.id)
    assert reloaded is not None
    assert reloaded.review_version == initial_version
    assert reloaded.active_card_id == card.id
    assert reloaded.state == CardState.NEW
    assert reloaded.due_at == due_at
    assert reloaded.last_review_at is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0


@pytest.mark.parametrize(
    "outcome", ["graded", "skipped", "service_unavailable", "unsupported"]
)
async def test_submit_review_given_duplicate_version_expect_stale_without_extra_log(
    db: AsyncSession, outcome: str
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(
        pool=pool, type=CardType.WRITE, payload_json={}
    )
    user_card = await UserCardFactory.create(user=user, pool=pool, active_card=card)
    service = build_service(db)
    rating = Rating.Again if outcome == "graded" else None
    reviewed, _ = await service.submit_review(
        user_id=user.id,
        user_card_id=user_card.id,
        card_id=card.id,
        outcome=outcome,
        rating=rating,
        review_version=0,
    )
    assert reviewed.review_version == 1
    due_at = reviewed.due_at
    state = reviewed.state
    await db.flush()
    db.expunge_all()

    with pytest.raises(StaleReviewError):
        await service.submit_review(
            user_id=user.id,
            user_card_id=user_card.id,
            card_id=card.id,
            outcome=outcome,
            rating=rating,
            review_version=0,
        )

    await db.flush()
    db.expunge_all()
    reloaded = await db.get(UserCard, user_card.id)
    assert reloaded is not None
    assert reloaded.review_version == 1
    assert reloaded.due_at == due_at
    assert reloaded.state == state
    assert reloaded.active_card_id is None
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == (
        1 if outcome == "graded" else 0
    )
