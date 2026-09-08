from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import User
from flyt.core.config import settings
from flyt.main import app
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_delete_users_me_given_a_session_expect_only_that_account_deleted(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    caller = await UserFactory.create()
    bystander = await UserFactory.create()
    await authenticate(client, caller)

    response = await client.request(
        "DELETE", "/users/me", json={"user_id": bystander.id}
    )

    assert response.status_code == HTTPStatus.OK
    assert await db.scalar(select(User).where(User.id == caller.id)) is None
    assert await db.scalar(select(User).where(User.id == bystander.id)) is not None


async def test_delete_users_me_given_no_session_expect_unauthenticated(
    client: AsyncClient,
) -> None:
    response = await client.delete("/users/me")

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_deletion_routes_given_the_contract_expect_no_identifier_accepted() -> (
    None
):
    paths = app.openapi()["paths"]
    contract = [
        paths["/users/me"]["delete"],
        paths["/users/me/deletion-preview"]["get"],
    ]

    for operation in contract:
        assert operation.get("parameters", []) == []
        assert "requestBody" not in operation


async def test_delete_users_me_given_success_expect_access_cookie_cleared(
    client: AsyncClient,
) -> None:
    caller = await UserFactory.create()
    await authenticate(client, caller)

    response = await client.delete("/users/me")

    assert response.status_code == HTTPStatus.OK
    cleared = response.headers["set-cookie"]
    assert cleared.startswith(f"{settings.ACCESS_COOKIE_NAME}=")
    assert "Max-Age=0" in cleared


async def test_get_current_user_given_a_deleted_subject_expect_token_stops_resolving(
    client: AsyncClient,
) -> None:
    caller = await UserFactory.create()
    await authenticate(client, caller)
    surviving_token = client.cookies.get(settings.ACCESS_COOKIE_NAME)

    assert (await client.delete("/users/me")).status_code == HTTPStatus.OK

    response = await client.get(
        "/users/me", headers={"Authorization": f"Bearer {surviving_token}"}
    )
    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_deletion_preview_given_a_session_expect_the_callers_own_figures(
    client: AsyncClient,
) -> None:
    caller = await UserFactory.create()
    await authenticate(client, caller)

    response = await client.get("/users/me/deletion-preview")

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "streak": 0,
        "reviews": 0,
        "wordsPracticed": 0,
        "importedTexts": 0,
    }


async def test_deletion_preview_given_no_session_expect_unauthenticated(
    client: AsyncClient,
) -> None:
    response = await client.get("/users/me/deletion-preview")

    assert response.status_code == HTTPStatus.UNAUTHORIZED
