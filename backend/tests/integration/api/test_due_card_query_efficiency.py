from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.users.models import UserLemma
from flyt.libs.utils.date import now
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import WordFormFactory
from tests.helpers.auth import authenticate
from tests.helpers.sql_log import capture_sql

pytestmark = pytest.mark.anyio

K_DUE_CARD_COUNTS = (1, 12)
K_MAX_DUE_SELECTS = 14
K_QUICK_CARD_COUNT = 10


@pytest.mark.parametrize("card_count", K_DUE_CARD_COUNTS)
@pytest.mark.parametrize("enrollment", [Enrollment.ACTIVE, Enrollment.UPCOMING])
async def test_due_cards_given_lemma_pools_expect_batched_reads_and_preserved_enrollment(
    client: AsyncClient, db: AsyncSession, card_count: int, enrollment: Enrollment
) -> None:
    user = await UserFactory.create()
    cards = []
    lemma_ids = []
    for index in range(card_count):
        lemma = await LemmaFactory.create(word=f"word-{index}")
        lemma_ids.append(lemma.id)
        await WordFormFactory.create(lemma=lemma, form=f"form-{index}")
        pool = await CardPoolFactory.create(lemma=lemma, frequency_rank=index)
        await FlashCardFactory.create(pool=pool, is_addable=True)
        cards.append(
            await UserCardFactory.create(
                user=user,
                pool=pool,
                state=CardState.NEW
                if enrollment is Enrollment.UPCOMING
                else CardState.REVIEW,
                enrollment_state=enrollment,
                due_at=now(),
            )
        )
    await UserLemmaFactory.create(
        user_id=user.id, lemma_id=lemma_ids[0], is_mastered=True
    )
    await authenticate(client, user)
    db.expunge_all()

    with capture_sql(db) as executed:
        response = await client.get("/me/cards/due")

    assert response.status_code == HTTPStatus.OK
    assert [item["id"] for item in response.json()] == [card.id for card in cards]
    assert all(item["word_forms"] for item in response.json())
    selects = [statement for statement, _ in executed if statement.startswith("SELECT")]
    pool_reads = [
        statement
        for statement in selects
        if statement.startswith("SELECT flashcard_card_pools.")
    ]
    assert len(pool_reads) == (2 if enrollment is Enrollment.UPCOMING else 1)
    assert len(selects) <= K_MAX_DUE_SELECTS, selects
    db.expunge_all()
    reloaded_cards = (
        await db.scalars(select(UserCard).where(UserCard.user_id == user.id))
    ).all()
    assert all(card.enrollment_state is Enrollment.ACTIVE for card in reloaded_cards)
    if enrollment is Enrollment.UPCOMING:
        assert all(card.introduced_at is not None for card in reloaded_cards)
        vocabulary = (
            await db.scalars(select(UserLemma).where(UserLemma.user_id == user.id))
        ).all()
        assert {entry.lemma_id for entry in vocabulary} == set(lemma_ids)
    mastered = await db.scalar(
        select(UserLemma.is_mastered).where(
            UserLemma.user_id == user.id, UserLemma.lemma_id == lemma_ids[0]
        )
    )
    assert mastered is True


async def test_quick_due_cards_given_larger_queue_expect_previews_only_for_returned_cards(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await UserFactory.create()
    for index in range(max(K_DUE_CARD_COUNTS)):
        pool = await CardPoolFactory.create(key=f"quick-{index}")
        await FlashCardFactory.create(pool=pool, is_addable=True)
        await UserCardFactory.create(user=user, pool=pool, state=CardState.REVIEW)
    previewed_ids = []
    build_previews = FlashcardReviewService.rating_previews

    def record_previews(
        service: FlashcardReviewService, card: UserCard
    ) -> dict[str, str]:
        previewed_ids.append(card.id)
        return build_previews(service, card)

    monkeypatch.setattr(FlashcardReviewService, "rating_previews", record_previews)
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get("/me/cards/due", params={"mode": "quick"})

    assert response.status_code == HTTPStatus.OK
    assert len(response.json()) == K_QUICK_CARD_COUNT
    assert previewed_ids == [item["id"] for item in response.json()]
