import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.users.models import UserLemma
from flyt.apps.users.services import UserLemmaService
from tests.factories import CardPoolFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserLemmaFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


async def test_sync_lemma_mastery_from_user_card_given_review_and_stable_expect_mastered(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="mastery-pool")
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        fsrs_stability=120,
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=lemma,
        is_mastered=False,
    )

    await UserLemmaService(async_session).sync_lemma_mastery_from_user_card(user_card)

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_sync_lemma_mastery_from_user_card_given_non_review_state_expect_known_state_preserved(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(
        lemma=lemma,
        key="mastery-pool-non-review",
    )
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.LEARNING,
        fsrs_stability=120,
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=lemma,
        is_mastered=True,
    )

    await UserLemmaService(async_session).sync_lemma_mastery_from_user_card(user_card)

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_sync_lemma_mastery_from_user_card_given_low_stability_expect_known_state_preserved(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(
        lemma=lemma,
        key="mastery-pool-below-threshold",
    )
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        fsrs_stability=89,
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=lemma,
        is_mastered=True,
    )

    await UserLemmaService(async_session).sync_lemma_mastery_from_user_card(user_card)

    user_lemma = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_sync_lemma_mastery_from_user_card_given_pool_without_lemma_expect_no_user_lemma(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create(key="mastery-pool-no-lemma")
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        fsrs_stability=120,
    )

    await UserLemmaService(async_session).sync_lemma_mastery_from_user_card(user_card)

    user_lemma = await async_session.scalar(
        select(UserLemma).where(UserLemma.user_id == user.id)
    )
    assert user_lemma is None


async def test_ensure_lemma_for_user_creates_missing_row(
    async_session: AsyncSession,
) -> None:
    service = UserLemmaService(async_session)
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()

    await service.ensure_lemma_for_user(user.id, lemma.id)

    row = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert row is not None
    assert row.is_mastered is False


async def test_ensure_lemma_for_user_preserves_mastered(
    async_session: AsyncSession,
) -> None:
    service = UserLemmaService(async_session)
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    async_session.add(UserLemma(user_id=user.id, lemma_id=lemma.id, is_mastered=True))
    await async_session.flush()

    await service.ensure_lemma_for_user(user.id, lemma.id)

    row = await async_session.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert row is not None
    assert row.is_mastered is True


async def test_ensure_lemma_for_user_is_idempotent(
    async_session: AsyncSession,
) -> None:
    service = UserLemmaService(async_session)
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()

    await service.ensure_lemma_for_user(user.id, lemma.id)
    await service.ensure_lemma_for_user(user.id, lemma.id)

    count = await async_session.scalar(
        select(func.count())
        .select_from(UserLemma)
        .where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert count == 1
