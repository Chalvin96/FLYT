"""Integration tests for the GET /me/decks endpoint and mark-known promotion."""

from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from flyt.apps.users.models import UserLemma
from tests.factories import CardPoolFactory
from tests.factories import DeckFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio

K_EXPECTED_PARTIAL_DECK_CARD_COUNT = 3
K_EXPECTED_OWNED_DECK_CARD_COUNT = 2
K_EXPECTED_ADDABLE_CARD_COUNT = 3
K_EXPECTED_ZERO_OVERLAP_CARD_COUNT = 2


async def test_list_decks_given_authenticated_user_expect_deck_summaries(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Most Frequent Words", cefr_range="A1-B2")
    pool = await CardPoolFactory.create(key="ld-pool")
    await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pool)

    await authenticate(client, user)

    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body) == 1
    item = body[0]
    assert item["id"] == deck.id
    assert item["name"] == "Most Frequent Words"
    assert item["card_count"] == 1
    assert item["cefr_range"] == "A1-B2"
    assert item["is_subscribed"] is True
    assert item["studied_count"] == 0
    assert "description" in item


async def test_list_decks_given_partial_overlap_expect_not_subscribed(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Partial Overlap")
    pools = [
        await CardPoolFactory.create(key="partial-a"),
        await CardPoolFactory.create(key="partial-b"),
        await CardPoolFactory.create(key="partial-c"),
    ]
    for pool in pools:
        await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pools[0])

    await authenticate(client, user)
    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body) == 1
    assert body[0]["card_count"] == K_EXPECTED_PARTIAL_DECK_CARD_COUNT
    assert body[0]["is_subscribed"] is False


async def test_list_decks_given_all_addable_pools_owned_expect_subscribed(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Full Ownership")
    pool_a = await CardPoolFactory.create(key="full-a")
    pool_b = await CardPoolFactory.create(key="full-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)

    await authenticate(client, user)
    subscribe_response = await client.post(f"/me/decks/{deck.id}/subscribe")
    assert subscribe_response.status_code == HTTPStatus.OK

    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body) == 1
    assert body[0]["card_count"] == K_EXPECTED_OWNED_DECK_CARD_COUNT
    assert body[0]["is_subscribed"] is True


async def test_list_decks_given_all_pools_active_expect_still_subscribed(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Promoted Subscriber")
    pools = [
        await CardPoolFactory.create(key="active-a"),
        await CardPoolFactory.create(key="active-b"),
    ]
    for index, pool in enumerate(pools):
        await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
        await UserCardFactory.create(
            user=user,
            pool=pool,
            enrollment_state=Enrollment.ACTIVE,
            state=CardState.REVIEW if index == 0 else CardState.NEW,
        )

    await authenticate(client, user)
    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body) == 1
    assert body[0]["is_subscribed"] is True
    assert body[0]["studied_count"] == 1


async def test_list_decks_given_zero_overlap_expect_not_subscribed(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Zero Overlap")
    pool_a = await CardPoolFactory.create(key="zero-a")
    pool_b = await CardPoolFactory.create(key="zero-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)

    await authenticate(client, user)
    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body) == 1
    assert body[0]["card_count"] == K_EXPECTED_ZERO_OVERLAP_CARD_COUNT
    assert body[0]["is_subscribed"] is False


async def test_list_decks_given_no_decks_expect_empty_list(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/decks")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


async def test_list_decks_given_unauthenticated_expect_401(
    client: AsyncClient,
) -> None:
    response = await client.get("/me/decks")
    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_list_decks_counts_are_correct(client: AsyncClient) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create(name="Freq", cefr_range="A1-A2")
    pool_a = await CardPoolFactory.create()
    pool_b = await CardPoolFactory.create()
    # 2 addable cards in pool_a, 1 addable in pool_b, 1 non-addable in pool_a.
    await FlashCardFactory.create(pool=pool_a, deck=deck, is_addable=True)
    await FlashCardFactory.create(pool=pool_a, deck=deck, is_addable=True)
    await FlashCardFactory.create(pool=pool_b, deck=deck, is_addable=True)
    await FlashCardFactory.create(pool=pool_a, deck=deck, is_addable=False)
    # User has studied pool_a (state != NEW).
    await UserCardFactory.create(user=user, pool=pool_a, state=CardState.REVIEW)

    await authenticate(client, user)
    resp = await client.get("/me/decks")

    assert resp.status_code == HTTPStatus.OK
    item = next(d for d in resp.json() if d["id"] == deck.id)
    assert item["card_count"] == K_EXPECTED_ADDABLE_CARD_COUNT  # addable cards only
    assert item["studied_count"] == 1  # distinct studied user_cards, state != NEW
    assert item["is_subscribed"] is False  # owns 1 of 2 addable pools


async def test_mark_known_given_upcoming_card_expect_mastered_without_activation(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="mk-upcoming")
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.UPCOMING,
    )

    await authenticate(client, user)
    response = await client.post(f"/lexicons/lemmas/{lemma.uuid}/mark-known")

    assert response.status_code == HTTPStatus.OK
    card = await db.scalar(
        select(UserCard).where(
            UserCard.user_id == user.id,
            UserCard.pool_id == pool.id,
        )
    )
    assert card is not None
    assert card.enrollment_state == Enrollment.UPCOMING

    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_mark_known_given_active_card_expect_mastered_without_conflict(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="mk-active")
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.ACTIVE,
    )

    await authenticate(client, user)
    response = await client.post(f"/lexicons/lemmas/{lemma.uuid}/mark-known")

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True
