import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from flyt.apps.flashcards.models import CardPool
from tests.factories import LemmaFactory
from tests.factories import LessonFactory
from tests.factories import UserCardFactory

pytestmark = pytest.mark.anyio


async def test_user_card_given_py_fsrs_migration_expect_fsrs_columns_available(
    async_session: AsyncSession,
) -> None:
    user_card = await UserCardFactory.create()

    assert hasattr(user_card, "fsrs_stability")
    assert hasattr(user_card, "fsrs_difficulty")
    assert hasattr(user_card, "fsrs_step")
    assert hasattr(user_card, "last_review_at")
    assert not hasattr(user_card, "reps")
    assert not hasattr(user_card, "ease_factor")
    assert not hasattr(user_card, "interval")


async def test_card_pool_given_both_sources_null_expect_integrity_error(
    async_session: AsyncSession,
) -> None:
    async_session.add(CardPool(key="invalid-pool-null", lesson_id=None, lemma_id=None))

    with pytest.raises(IntegrityError):
        await async_session.flush()
    await async_session.rollback()


async def test_card_pool_given_both_sources_set_expect_integrity_error(
    async_session: AsyncSession,
) -> None:
    lesson = await LessonFactory.create()
    lemma = await LemmaFactory.create()
    async_session.add(
        CardPool(
            key="invalid-pool-both",
            lesson_id=lesson.id,
            lemma_id=lemma.id,
        )
    )

    with pytest.raises(IntegrityError):
        await async_session.flush()
    await async_session.rollback()
