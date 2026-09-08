"""End-to-end OAuth integration tests.

These tests exercise the real authlib code paths (authorize_access_token,
parse_id_token, JWT validation) by mocking only the external HTTP calls
to Google's endpoints.  This catches signature / API changes in authlib
that method-level mocks would hide.
"""

import base64
import json
import time
from http import HTTPStatus
from unittest.mock import AsyncMock
from unittest.mock import patch

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import AsyncClient
from itsdangerous import TimestampSigner
from joserfc import jwt as joserfc_jwt
from joserfc.jwk import RSAKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.sessions import SessionMiddleware

from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.core.config import settings

pytestmark = pytest.mark.anyio

# -- Test key / JWT helpers -------------------------------------------------

_KID = "test-key-1"

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_RSA_KEY = RSAKey.import_key(_PRIVATE_KEY)
_MOCK_JWT_VALUE = "changeme"

_PUB_JWK = RSAKey.import_key(_PRIVATE_KEY.public_key()).as_dict()
_PUB_JWK["kid"] = _KID

_GOOGLE_METADATA = {
    "issuer": "https://accounts.google.com",
    "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_endpoint": "https://oauth2.googleapis.com/token",
    "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
    "id_token_signing_alg_values_supported": ["RS256"],
    "_loaded_at": time.time(),
}


def _make_id_token(claims: dict) -> str:
    header = {"alg": "RS256", "kid": _KID}
    return joserfc_jwt.encode(header, claims, _RSA_KEY)


def _extract_state(url: str) -> str:
    from urllib.parse import parse_qs
    from urllib.parse import urlparse

    return parse_qs(urlparse(url).query)["state"][0]


def _read_session_cookie(client: AsyncClient) -> dict:
    session_cookie = client.cookies.get("oauth_session")
    if not session_cookie:
        return {}

    from flyt.main import app

    secret_key = None
    for mw in app.user_middleware:
        if mw.cls is SessionMiddleware:
            secret_key = mw.kwargs["secret_key"]
            break
    if secret_key is None:
        return {}

    signer = TimestampSigner(secret_key)
    raw = signer.unsign(session_cookie)
    return json.loads(base64.urlsafe_b64decode(raw))


def _get_nonce(client: AsyncClient, state: str) -> str | None:
    session = _read_session_cookie(client)
    key = f"_state_google_{state}"
    return session.get(key, {}).get("data", {}).get("nonce")


# -- Fixtures ---------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_oauth_state():
    from flyt.clients.oauth import oauth

    oauth.google.server_metadata.clear()
    oauth.google.server_metadata.update(_GOOGLE_METADATA)
    yield
    oauth.google.server_metadata.clear()


# -- Integration tests ------------------------------------------------------


async def test_login_integration_given_valid_google_response_expect_success(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """Full end-to-end: start -> callback -> user created, access cookie set."""
    start_resp = await client.get("/users/oauth/google/start", follow_redirects=False)
    assert start_resp.status_code == HTTPStatus.FOUND
    state = _extract_state(start_resp.headers["location"])
    nonce = _get_nonce(client, state)

    now = int(time.time())
    claims = {
        "sub": "google-int-123",
        "iss": "https://accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID,
        "email": "integration@example.com",
        "email_verified": True,
        "name": "Integration User",
        "picture": "https://img.example.com/photo.jpg",
        "exp": now + 3600,
        "iat": now,
    }
    if nonce:
        claims["nonce"] = nonce
    id_token = _make_id_token(claims)

    token_response = {
        "access_token": _MOCK_JWT_VALUE,
        "id_token": id_token,
        "token_type": "Bearer",
        "expires_in": 3600,
    }

    with (
        patch(
            "flyt.clients.oauth.oauth.google.fetch_access_token",
            new_callable=AsyncMock,
            return_value=token_response,
        ),
        patch(
            "flyt.clients.oauth.oauth.google.fetch_jwk_set",
            new_callable=AsyncMock,
            return_value={"keys": [_PUB_JWK]},
        ),
    ):
        cb_resp = await client.get(
            f"/users/oauth/google/callback?state={state}&code=test-auth-code",
            follow_redirects=False,
        )

    assert cb_resp.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert cb_resp.headers["location"] == settings.FRONTEND_LOGIN_SUCCESS_URL

    access_cookie = cb_resp.cookies.get(settings.ACCESS_COOKIE_NAME)
    assert access_cookie is not None
    decoded = pyjwt.decode(
        access_cookie, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )
    assert "sub" in decoded

    user = await db.scalar(select(User).where(User.uuid == decoded["sub"]))
    assert user is not None
    assert user.email == "integration@example.com"
    assert user.display_name == "Integration User"

    identity = await db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "google",
            AuthIdentity.provider_subject == "google-int-123",
            AuthIdentity.user_id == user.id,
        )
    )
    assert identity is not None
    assert identity.email_at_link == "integration@example.com"

    client.cookies.set(settings.ACCESS_COOKIE_NAME, access_cookie)
    me_resp = await client.get("/users/me")
    assert me_resp.status_code == HTTPStatus.OK
    assert me_resp.json()["email"] == "integration@example.com"


async def test_login_integration_given_missing_id_token_expect_failure(
    client: AsyncClient,
) -> None:
    """Token endpoint returns no id_token -> userinfo is None -> provider error."""
    start_resp = await client.get("/users/oauth/google/start", follow_redirects=False)
    state = _extract_state(start_resp.headers["location"])

    token_response = {
        "access_token": _MOCK_JWT_VALUE,
        "token_type": "Bearer",
        "expires_in": 3600,
    }

    with patch(
        "flyt.clients.oauth.oauth.google.fetch_access_token",
        new_callable=AsyncMock,
        return_value=token_response,
    ):
        cb_resp = await client.get(
            f"/users/oauth/google/callback?state={state}&code=test-auth-code",
            follow_redirects=False,
        )

    assert cb_resp.status_code == HTTPStatus.TEMPORARY_REDIRECT
    assert "error=provider" in cb_resp.headers["location"]
    assert cb_resp.cookies.get(settings.ACCESS_COOKIE_NAME) is None


async def test_login_integration_given_tampered_id_token_expect_failure(
    client: AsyncClient,
) -> None:
    """id_token signed by a different key -> JWT validation fails -> login denied."""
    start_resp = await client.get("/users/oauth/google/start", follow_redirects=False)
    state = _extract_state(start_resp.headers["location"])
    nonce = _get_nonce(client, state)

    now = int(time.time())
    claims = {
        "sub": "google-int-attacker",
        "iss": "https://accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID,
        "email": "attacker@example.com",
        "email_verified": True,
        "name": "Attacker",
        "exp": now + 3600,
        "iat": now,
    }
    if nonce:
        claims["nonce"] = nonce

    attacker_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    attacker_rsa = RSAKey.import_key(attacker_key)
    tampered_token = joserfc_jwt.encode(
        {"alg": "RS256", "kid": _KID}, claims, attacker_rsa
    )

    token_response = {
        "access_token": _MOCK_JWT_VALUE,
        "id_token": tampered_token,
        "token_type": "Bearer",
        "expires_in": 3600,
    }

    with (
        patch(
            "flyt.clients.oauth.oauth.google.fetch_access_token",
            new_callable=AsyncMock,
            return_value=token_response,
        ),
        patch(
            "flyt.clients.oauth.oauth.google.fetch_jwk_set",
            new_callable=AsyncMock,
            return_value={"keys": [_PUB_JWK]},
        ),
    ):
        cb_resp = await client.get(
            f"/users/oauth/google/callback?state={state}&code=test-auth-code",
            follow_redirects=False,
        )

    assert cb_resp.status_code == HTTPStatus.TEMPORARY_REDIRECT
    # Signature validation fails inside authorize_access_token (JoseError),
    # which the callback maps to error=state.
    assert "error=state" in cb_resp.headers["location"]
    assert cb_resp.cookies.get(settings.ACCESS_COOKIE_NAME) is None
