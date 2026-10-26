from http import HTTPStatus

import pytest
from httpx import AsyncClient

from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize("identifier", [20437061041055703040, 2147483648, 0, -1])
@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/lessons/{identifier}", None),
        ("POST", "/lessons/{identifier}/start", None),
        ("POST", "/lessons/{identifier}/complete", None),
        ("POST", "/lessons/{identifier}/exercises/ex-choose/complete", None),
        (
            "POST",
            "/lessons/{identifier}/exercises/ex-write/judge-write",
            {"response": "Hei"},
        ),
        (
            "POST",
            "/me/cards/{identifier}/review",
            {"card_id": 1, "rating": 3, "review_version": 0},
        ),
        ("POST", "/me/decks/{identifier}/subscribe", None),
    ],
)
async def test_integer_id_given_out_of_range_expect_request_validation_error(
    client: AsyncClient,
    identifier: int,
    method: str,
    path: str,
    body: dict | None,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.request(
        method, path.format(identifier=identifier), json=body
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json()["detail"][0]["loc"][0] == "path"


@pytest.mark.parametrize("identifier", [1, 2147483647])
async def test_integer_id_given_postgres_boundaries_expect_domain_not_found(
    client: AsyncClient, identifier: int
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(f"/lessons/{identifier}/start")

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "LESSON_NOT_FOUND"
