"""Integration tests for the X-Request-ID correlation header.

Covers the ``asgi-correlation-id`` middleware wiring: every response must carry
an ``X-Request-ID`` header, and a client-supplied value must be echoed back
unchanged.
"""

from http import HTTPStatus

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def test_response_given_any_request_expect_request_id_header(
    client: AsyncClient,
) -> None:
    response = await client.get("/health/live")

    assert response.status_code == HTTPStatus.OK
    assert "x-request-id" in response.headers
    assert response.headers["x-request-id"]


async def test_request_id_given_client_supplied_header_expect_echoed(
    client: AsyncClient,
) -> None:
    # asgi-correlation-id validates inbound IDs as UUID4; use a valid one.
    request_id = "12345678-1234-4234-8234-123456789abc"
    response = await client.get(
        "/health/live",
        headers={"X-Request-ID": request_id},
    )

    assert response.status_code == HTTPStatus.OK
    assert response.headers["x-request-id"] == request_id
