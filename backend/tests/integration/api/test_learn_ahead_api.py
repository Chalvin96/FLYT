"""Integration tests for the add-more-new API (replaces learn-ahead)."""

from http import HTTPStatus

import pytest
from httpx import AsyncClient

from flyt.apps.flashcards.models import Enrollment
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserSettingsFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio

K_EXPECTED_PROMOTED_COUNT = 3


async def _make_upcoming(user, *, rank: int, key: str):
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key=key, frequency_rank=rank)
    await FlashCardFactory.create(pool=pool, is_addable=True)
    return await UserCardFactory.create(
        user=user,
        pool=pool,
        enrollment_state=Enrollment.UPCOMING,
    )


async def test_add_more_new_given_upcoming_cards_expect_promoted_count(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=2)
    for i in range(3):
        await _make_upcoming(user, rank=i + 1, key=f"amn-api-{i}")

    await authenticate(client, user)

    response = await client.post("/me/cards/add-more-new")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["promoted"] == K_EXPECTED_PROMOTED_COUNT


async def test_add_more_new_given_less_than_endpoint_cap_expect_available_count(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=10)
    for i in range(3):
        await _make_upcoming(user, rank=i + 1, key=f"amn-clamp-{i}")

    await authenticate(client, user)

    response = await client.post("/me/cards/add-more-new")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["promoted"] == K_EXPECTED_PROMOTED_COUNT


async def test_add_more_new_zero_when_none_upcoming(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post("/me/cards/add-more-new")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["promoted"] == 0


async def test_add_more_new_unauthenticated_returns_401(
    client: AsyncClient,
) -> None:
    response = await client.post("/me/cards/add-more-new")
    assert response.status_code == HTTPStatus.UNAUTHORIZED
