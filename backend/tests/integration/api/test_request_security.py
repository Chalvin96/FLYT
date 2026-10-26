from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest
from httpx import AsyncClient

from flyt.core.config import settings
from tests.factories import UserFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio

K_MAX_API_BODY_BYTES = 64 * 1024 * 1024


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.parametrize("origin", [None, "https://untrusted.example", "null"])
async def test_cookie_mutation_given_missing_or_untrusted_origin_expect_forbidden(
    client: AsyncClient, method: str, origin: str | None
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    client.headers.pop("Origin", None)
    headers = {"Origin": origin} if origin is not None else {}

    response = await client.request(method, "/users/me", headers=headers)

    assert response.status_code == HTTPStatus.FORBIDDEN
    assert response.json()["detail"]["code"] == "ORIGIN_NOT_ALLOWED"
    assert set(response.json()["detail"]) == {"code", "message", "error"}


@pytest.mark.parametrize("header", ["Origin", "Referer"])
async def test_cookie_mutation_given_allowed_origin_expect_success(
    client: AsyncClient, header: str
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    client.headers.pop("Origin", None)
    origin = settings.FRONTEND_ORIGINS[0]
    value = origin if header == "Origin" else f"{origin}/settings?tab=account"

    response = await client.patch(
        "/users/me", json={"display_name": "Renamed"}, headers={header: value}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["display_name"] == "Renamed"


async def test_cookie_mutation_given_disallowed_origin_and_allowed_referer_expect_forbidden(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.patch(
        "/users/me",
        json={"display_name": "Renamed"},
        headers={
            "Origin": "https://untrusted.example",
            "Referer": f"{settings.FRONTEND_ORIGINS[0]}/settings",
        },
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


async def test_admin_mutation_given_cookie_and_bearer_header_expect_origin_required(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    client.headers.pop("Origin", None)

    response = await client.post(
        "/admin/user/edit/1", headers={"Authorization": "Bearer invalid"}
    )

    assert response.status_code == HTTPStatus.FORBIDDEN
    assert response.json()["detail"]["code"] == "ORIGIN_NOT_ALLOWED"


async def test_cookie_read_given_missing_origin_expect_success(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    client.headers.pop("Origin", None)

    response = await client.get("/users/me")

    assert response.status_code == HTTPStatus.OK


async def test_api_body_given_oversized_content_length_expect_413_before_parsing(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/imports",
        content=b"{invalid json",
        headers={"Content-Length": str(K_MAX_API_BODY_BYTES + 1)},
    )

    assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert response.json()["detail"]["code"] == "REQUEST_BODY_TOO_LARGE"


@pytest.mark.parametrize("declared_length", [None, "1"])
async def test_api_body_given_oversized_stream_expect_413_before_parsing(
    client: AsyncClient, declared_length: str | None
) -> None:
    async def generate_body() -> AsyncIterator[bytes]:
        for _ in range(64):
            yield b"x" * (1024 * 1024)
        yield b"x"

    response = await client.post(
        "/imports",
        content=generate_body(),
        headers={"Content-Length": declared_length} if declared_length else {},
    )

    assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert response.json()["detail"]["code"] == "REQUEST_BODY_TOO_LARGE"


@pytest.mark.parametrize("path", ["/", "/missing", "/admin/login"])
async def test_security_headers_given_api_and_admin_responses_expect_frame_protection(
    client: AsyncClient, path: str
) -> None:
    response = await client.get(path)

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Content-Security-Policy"] == "frame-ancestors 'none'"


@pytest.mark.parametrize("environment", ["development", "test", "e2e", "production"])
async def test_security_headers_given_environment_expect_hsts_only_in_production(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, environment: str
) -> None:
    monkeypatch.setattr(settings, "ENV", environment)

    response = await client.get("/")

    if environment == "production":
        assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
    else:
        assert "Strict-Transport-Security" not in response.headers


async def test_security_headers_given_cors_preflight_expect_nosniff(
    client: AsyncClient,
) -> None:
    response = await client.options(
        "/users/me",
        headers={
            "Origin": settings.FRONTEND_ORIGINS[0],
            "Access-Control-Request-Method": "PATCH",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["X-Content-Type-Options"] == "nosniff"


async def test_security_headers_given_unexpected_error_expect_protected_json() -> None:
    from fastapi import FastAPI
    from httpx import ASGITransport

    from flyt.core.middleware import SecurityHeadersMiddleware
    from flyt.main import unexpected_exception_handler

    failing_app = FastAPI(exception_handlers={Exception: unexpected_exception_handler})
    failing_app.add_middleware(SecurityHeadersMiddleware, config=settings)

    @failing_app.get("/")
    async def raise_error() -> None:
        raise RuntimeError("unexpected failure")

    async with AsyncClient(
        transport=ASGITransport(app=failing_app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.get("/")

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response.json()["detail"]["code"] == "INTERNAL_ERROR"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Content-Security-Policy"] == "frame-ancestors 'none'"


async def test_cookie_mutation_given_valid_bearer_and_untrusted_origin_expect_bearer_user(
    client: AsyncClient,
) -> None:
    from flyt.apps.users.services import AuthService

    cookie_user = await UserFactory.create()
    bearer_user = await UserFactory.create()
    await authenticate(client, cookie_user)
    token = AuthService().create_access_token(bearer_user)

    response = await client.patch(
        "/users/me",
        json={"display_name": "Bearer name"},
        headers={
            "Authorization": f"Bearer {token}",
            "Origin": "https://untrusted.example",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["uuid"] == str(bearer_user.uuid)
    assert cookie_user.display_name != "Bearer name"


async def test_request_given_nul_byte_in_query_expect_400_envelope(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/reading/stories", params={"group_key": "a\x00b"})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json()["detail"]["code"] == "INVALID_INPUT"


async def test_request_given_undecodable_json_body_expect_400_envelope(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        "/imports",
        content=b"\xff\xfe\x00",
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert set(response.json()["detail"]) == {"code", "message", "error"}
