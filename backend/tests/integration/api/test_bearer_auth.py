"""Tests for Bearer token auth support in users/deps.py.

Verifies that Authorization: Bearer <jwt> authenticates the same as the
access cookie on a protected endpoint, that the cookie path still works,
and that bad/absent tokens are rejected on required-auth endpoints.
"""

from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.users.models import UserLemma
from flyt.apps.users.services import AuthService
from tests.factories import LemmaFactory
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio


async def test_get_current_user_given_valid_bearer_token_expect_authenticated(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    token = AuthService().create_access_token(data={"sub": str(user.uuid)})

    response = await client.post(
        f"/lexicons/lemmas/{lemma.uuid}/mark-known",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_get_current_user_given_lowercase_bearer_prefix_expect_authenticated(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    token = AuthService().create_access_token(data={"sub": str(user.uuid)})

    response = await client.post(
        f"/lexicons/lemmas/{lemma.uuid}/mark-known",
        headers={"Authorization": f"bearer {token}"},
    )

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_get_current_user_given_cookie_only_expect_authenticated(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
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


async def test_get_current_user_given_no_token_expect_401(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create()

    response = await client.post(f"/lexicons/lemmas/{lemma.uuid}/mark-known")

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json()["detail"]["code"] == "AUTHENTICATION_FAILED"


async def test_get_current_user_given_invalid_bearer_token_expect_401(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create()

    response = await client.post(
        f"/lexicons/lemmas/{lemma.uuid}/mark-known",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json()["detail"]["code"] == "AUTHENTICATION_FAILED"


async def test_get_current_user_given_non_bearer_header_expect_cookie_fallback(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """An Authorization header that is not Bearer-prefixed should not break auth."""
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lexicons/lemmas/{lemma.uuid}/mark-known",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_get_current_user_given_bearer_and_cookie_expect_bearer_precedence(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """When both bearer and cookie are present, bearer wins."""
    bearer_user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    token = AuthService().create_access_token(data={"sub": str(bearer_user.uuid)})

    # Set a cookie for a different user but send bearer for bearer_user.
    cookie_user = await UserFactory.create()
    await authenticate(client, cookie_user)

    response = await client.post(
        f"/lexicons/lemmas/{lemma.uuid}/mark-known",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == HTTPStatus.OK
    bearer_user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == bearer_user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    cookie_user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == cookie_user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert bearer_user_lemma is not None
    assert bearer_user_lemma.is_mastered is True
    assert cookie_user_lemma is None
