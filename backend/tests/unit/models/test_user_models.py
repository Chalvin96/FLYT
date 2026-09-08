import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import UserLemma
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory

pytestmark = pytest.mark.anyio

EXPECTED_USER_LEMMA_COUNT = 2


async def test_user_lemma_given_valid_creation_expect_saved(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create(email="test@example.com")
    lemma = await LemmaFactory.create(word="test")

    user_lemma = await UserLemmaFactory.create(user=user, lemma=lemma)

    assert user_lemma.id is not None
    assert user_lemma.user_id == user.id
    assert user_lemma.lemma_id == lemma.id


async def test_user_lemma_given_unique_constraint_expect_enforcement(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()

    await UserLemmaFactory.create(user=user, lemma=lemma)

    with pytest.raises(IntegrityError):
        await UserLemmaFactory.create(user=user, lemma=lemma)
    await db.rollback()


async def test_user_lemma_given_same_user_different_lemma_expect_saved(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma1 = await LemmaFactory.create(word="First")
    lemma2 = await LemmaFactory.create(word="Second")

    await UserLemmaFactory.create(user=user, lemma=lemma1)
    await UserLemmaFactory.create(user=user, lemma=lemma2)

    user_lemmas = (
        (await db.execute(select(UserLemma).where(UserLemma.user_id == user.id)))
        .scalars()
        .all()
    )
    assert len(user_lemmas) == EXPECTED_USER_LEMMA_COUNT


async def test_user_lemma_given_different_user_same_lemma_expect_saved(
    db: AsyncSession,
) -> None:
    user1 = await UserFactory.create(email="user1@example.com")
    user2 = await UserFactory.create(email="user2@example.com")
    lemma = await LemmaFactory.create()

    await UserLemmaFactory.create(user=user1, lemma=lemma)
    await UserLemmaFactory.create(user=user2, lemma=lemma)

    user_lemmas = (
        (await db.execute(select(UserLemma).where(UserLemma.lemma_id == lemma.id)))
        .scalars()
        .all()
    )
    assert len(user_lemmas) == EXPECTED_USER_LEMMA_COUNT
