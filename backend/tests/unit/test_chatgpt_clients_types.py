import httpx
import pytest

from flyt.apps.chatgpt_link.clients import config
from flyt.apps.chatgpt_link.clients.api import ProviderApi
from flyt.apps.chatgpt_link.clients.types import ErrorResponse

pytestmark = pytest.mark.anyio


async def test_upstream_client_given_any_request_expect_user_agent_sent() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.headers)
        return httpx.Response(200, json={})

    async with ProviderApi().http_client(5.0) as client:
        client._transport = httpx.MockTransport(handler)
        await client.post("https://example.invalid/x", json={})

    assert seen["user-agent"] == config.USER_AGENT


def test_upstream_error_body_given_nested_error_expect_codes_in_priority_order() -> (
    None
):
    body = ErrorResponse.parse('{"error": {"code": "a", "type": "b"}}')

    assert body.first == "a"
    assert body.first_in({"b": 1}) == "b"
    assert bool(body) is True


def test_upstream_error_body_given_unparseable_expect_empty() -> None:
    body = ErrorResponse.parse("not json")

    assert body.first is None
    assert bool(body) is False
