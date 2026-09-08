from datetime import datetime
from datetime import timedelta
from datetime import UTC
from http import HTTPStatus
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import UserCard
from tests.factories import CardPoolFactory
from tests.factories import DeckFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import LessonFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio

K_EXPECTED_SUBSCRIBED_USER_CARD_COUNT = 2


async def test_subscribe_to_deck_given_authenticated_user_expect_cards_created_and_idempotent(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pool_a = await CardPoolFactory.create(key="pool-a")
    pool_b = await CardPoolFactory.create(key="pool-b")
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_a, is_addable=True)
    await FlashCardFactory.create(deck=deck, pool=pool_b, is_addable=True)

    await authenticate(client, user)

    response_1 = await client.post(f"/me/decks/{deck.id}/subscribe")
    assert response_1.status_code == HTTPStatus.OK
    assert response_1.json() == {}

    response_2 = await client.post(f"/me/decks/{deck.id}/subscribe")
    assert response_2.status_code == HTTPStatus.OK
    assert response_2.json() == {}

    user_card_count = await db.scalar(
        select(func.count(UserCard.id)).where(UserCard.user_id == user.id)
    )
    assert user_card_count == K_EXPECTED_SUBSCRIBED_USER_CARD_COUNT


async def test_subscribe_to_deck_given_missing_deck_expect_not_found(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post("/me/decks/999999/subscribe")

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "DECK_NOT_FOUND"
    assert detail["message"] == "Deck not found"


async def test_issue_due_cards_given_lesson_pool_expect_lesson_id(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    pool = await CardPoolFactory.create(lesson=lesson)
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pool, state=CardState.REVIEW)
    await authenticate(client, user)

    response = await client.get("/me/cards/due")

    assert response.status_code == HTTPStatus.OK
    assert response.json()[0]["lesson_id"] == lesson.id


async def test_issue_due_cards_given_repeated_requests_expect_active_variant_reused(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await UserCardFactory.create(user=user, pool=pool, state=CardState.REVIEW)
    await authenticate(client, user)

    first_response = await client.get("/me/cards/due")
    second_response = await client.get("/me/cards/due")

    assert first_response.status_code == HTTPStatus.OK
    assert second_response.status_code == HTTPStatus.OK
    assert (
        second_response.json()[0]["card"]["id"]
        == first_response.json()[0]["card"]["id"]
    )


async def test_review_card_given_sibling_variant_expect_not_found(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    shown = await FlashCardFactory.create(
        pool=pool,
        type=CardType.CHOOSE,
        is_addable=True,
        schema_version="4.0",
        payload_json={},
    )
    sibling = await FlashCardFactory.create(
        pool=pool,
        type=CardType.WRITE,
        is_addable=True,
        schema_version="4.0",
        payload_json={},
    )
    user_card = await UserCardFactory.create(
        user=user,
        pool=pool,
        state=CardState.REVIEW,
        due_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1),
        last_shown_card=sibling,
    )
    await authenticate(client, user)

    due_response = await client.get("/me/cards/due")
    assert due_response.status_code == HTTPStatus.OK
    assert due_response.json()[0]["card"]["id"] == shown.id

    response = await client.post(
        f"/me/cards/{user_card.id}/review",
        json={"outcome": "service_unavailable", "card_id": sibling.id},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "CARD_NOT_FOUND"


async def test_review_card_given_authenticated_user_expect_ok_and_schedule(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)
    await authenticate(client, user)

    due_response = await client.get("/me/cards/due")
    assert due_response.status_code == HTTPStatus.OK
    shown_card_id = due_response.json()[0]["card"]["id"]
    assert shown_card_id == variant.id

    response = await client.post(
        f"/me/cards/{user_card.id}/review",
        json={"rating": 3, "card_id": shown_card_id},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["card_state"] in {"learning", "review", "relearning"}
    assert "due_at" in body


async def _make_deck_with_pools(deck, keys: list[str]) -> list:
    """Create a deck with one addable FlashCard per pool key; return the pools."""
    pools = []
    for key in keys:
        pool = await CardPoolFactory.create(key=key)
        await FlashCardFactory.create(deck=deck, pool=pool, is_addable=True)
        pools.append(pool)
    return pools


async def _deck_item(client: AsyncClient, deck_id: int) -> dict:
    response = await client.get("/me/decks")
    assert response.status_code == HTTPStatus.OK
    return next(d for d in response.json() if d["id"] == deck_id)


async def test_list_decks_given_all_pools_owned_expect_subscribed(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pools = await _make_deck_with_pools(deck, ["fov-a", "fov-b", "fov-c"])
    for pool in pools:
        await UserCardFactory.create(user=user, pool=pool)
    await authenticate(client, user)

    item = await _deck_item(client, deck.id)
    assert item["is_subscribed"] is True


async def test_list_decks_given_all_pools_promoted_expect_still_subscribed(
    client: AsyncClient,
) -> None:
    # A fully-promoted subscriber owns all pools as ACTIVE/REVIEW (no UPCOMING) —
    # must stay subscribed (guards against a "has-UPCOMING" definition).
    user = await UserFactory.create()
    deck = await DeckFactory.create()
    pools = await _make_deck_with_pools(deck, ["prom-a", "prom-b"])
    for pool in pools:
        await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.REVIEW,
            enrollment_state=Enrollment.ACTIVE,
        )
    await authenticate(client, user)

    item = await _deck_item(client, deck.id)
    assert item["is_subscribed"] is True


async def test_review_card_given_out_of_range_rating_expect_validation_error(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)
    await authenticate(client, user)

    response = await client.post(
        f"/me/cards/{user_card.id}/review",
        json={"rating": 5, "card_id": variant.id},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_issue_due_cards_given_authenticated_user_expect_ordered_payloads(  # ume-ignore: UME-PY003
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    first_lemma = await LemmaFactory.create()
    first_pool = await CardPoolFactory.create(
        key="first-pool",
        lemma=first_lemma,
    )
    first_card = await FlashCardFactory.create(
        pool=first_pool,
        is_addable=True,
        schema_version="3.0",
        payload_json={
            "lemma_uuid": str(first_lemma.uuid),
            "word": "hund",
            "pos": "noun",
            "primary_translation": "dog",
            "definitions": [],
        },
    )
    second_lemma = await LemmaFactory.create()
    second_pool = await CardPoolFactory.create(
        key="second-pool",
        lemma=second_lemma,
    )
    second_card = await FlashCardFactory.create(
        pool=second_pool,
        is_addable=True,
        payload_json={
            "lemma_uuid": str(second_lemma.uuid),
            "word": "katt",
            "pos": "noun",
            "primary_translation": "cat",
            "definitions": [],
        },
    )
    now_n = datetime.now(UTC).replace(tzinfo=None)
    later_user_card = await UserCardFactory.create(
        user=user,
        pool=second_pool,
        state=CardState.REVIEW,
        due_at=now_n - timedelta(minutes=5),
    )
    earlier_user_card = await UserCardFactory.create(
        user=user,
        pool=first_pool,
        state=CardState.REVIEW,
        due_at=now_n - timedelta(minutes=60),
    )

    await authenticate(client, user)

    response = await client.get("/me/cards/due")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [card["id"] for card in body] == [earlier_user_card.id, later_user_card.id]
    assert body[0]["pool_id"] == first_pool.id
    assert body[0]["card"]["id"] == first_card.id
    assert body[1]["card"]["id"] == second_card.id
    assert body[0]["card"]["schema_version"] == "3.0"
    assert body[0]["card"]["payload"]["lemma_uuid"] == str(first_lemma.uuid)
    assert body[0]["card"]["payload"]["primary_translation"] == "dog"
    assert body[1]["card"]["payload"]["lemma_uuid"] == str(second_lemma.uuid)
    assert body[1]["card"]["payload"]["primary_translation"] == "cat"


async def test_issue_due_cards_given_empty_queue_expect_empty_list(  # ume-ignore: UME-PY003
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/cards/due")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


async def test_issue_due_cards_given_quick_mode_expect_first_ten_cards_only(  # ume-ignore: UME-PY003
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    queued_user_cards = []
    base = datetime.now(UTC).replace(tzinfo=None)

    for minute in range(12):
        pool = await CardPoolFactory.create(key=f"pool-{minute}")
        await FlashCardFactory.create(pool=pool, is_addable=True)
        user_card = await UserCardFactory.create(
            user=user,
            pool=pool,
            state=CardState.LEARNING,
            due_at=base + timedelta(minutes=minute),
        )
        queued_user_cards.append(user_card)

    await authenticate(client, user)

    response = await client.get("/me/cards/due", params={"mode": "quick"})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [card["id"] for card in body] == [card.id for card in queued_user_cards[:10]]


async def test_issue_due_cards_given_invalid_mode_expect_validation_error(  # ume-ignore: UME-PY003
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/cards/due", params={"mode": "weird"})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_review_card_given_missing_user_card_expect_not_found(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    await authenticate(client, user)

    response = await client.post(
        "/me/cards/999999/review",
        json={"rating": 3, "card_id": variant.id},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "CARD_NOT_FOUND"


async def test_review_card_given_variant_from_other_pool_expect_not_found(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    user_card = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)

    other_pool = await CardPoolFactory.create()
    other_variant = await FlashCardFactory.create(pool=other_pool, is_addable=True)

    await authenticate(client, user)

    response = await client.post(
        f"/me/cards/{user_card.id}/review",
        json={"rating": 3, "card_id": other_variant.id},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "CARD_NOT_FOUND"


async def test_review_card_given_invalid_rating_zero_expect_validation_error(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    variant = await FlashCardFactory.create(pool=pool, is_addable=True)
    user_card = await UserCardFactory.create(user=user, pool=pool, state=CardState.NEW)
    await authenticate(client, user)

    response = await client.post(
        f"/me/cards/{user_card.id}/review",
        json={"rating": 0, "card_id": variant.id},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_add_lemma_to_deck_given_missing_lemma_uuid_expect_not_found(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/me/cards/lemmas/{uuid4()}/add-to-deck",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    detail = response.json()["detail"]
    assert detail["code"] == "LEMMA_NOT_DECKABLE"


async def test_add_more_new_given_no_upcoming_cards_expect_zero_promoted(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post("/me/cards/add-more-new")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["promoted"] == 0


async def test_list_my_cards_given_new_user_expect_empty_summary(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/cards")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["cards"] == []
    assert body["summary"]["total"] == 0
    assert body["page"] == 1
    assert body["has_more"] is False


async def test_list_my_cards_given_unauthenticated_expect_401(
    client: AsyncClient,
) -> None:
    response = await client.get("/me/cards")

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_list_my_cards_given_invalid_facet_expect_422(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/me/cards", params={"facet": "invalid"})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
