import json

import httpx
import pytest

from flyt.apps.chatgpt_link.clients import api
from flyt.apps.chatgpt_link.clients.manager import responses
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.apps.chatgpt_link.types import ProofVerdict
from pydantic import SecretStr

pytestmark = pytest.mark.anyio

_JWT_VALUE = "jwt.header.payloadsig"
_ACCOUNT_ID = "acct-test"


def _credential() -> ChatGPTCredential:
    from datetime import timedelta
    from flyt.libs.utils.date import now

    return ChatGPTCredential(
        access_token=SecretStr(_JWT_VALUE),
        refresh_token=SecretStr("rt-1"),
        chatgpt_account_id=_ACCOUNT_ID,
        access_token_expires_at=now() + timedelta(hours=1),
    )


def _stub(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        api.ProviderApi,
        "http_client",
        lambda self, timeout, headers=None: httpx.AsyncClient(
            transport=transport, timeout=timeout, headers=headers
        ),
    )


def _sse(event: str, data: dict | None = None) -> str:
    parts = [f"event: {event}\n"]
    if data is not None:
        parts.append(f"data: {json.dumps(data)}\n")
    parts.append("\n")
    return "".join(parts)


def _assert_headers(request: httpx.Request) -> None:
    assert request.headers["authorization"] == f"Bearer {_JWT_VALUE}"
    assert request.headers["chatgpt-account-id"] == _ACCOUNT_ID
    assert request.headers["originator"] == "flyt"
    assert request.headers["openai-beta"] == "responses=experimental"
    assert request.headers["accept"] == "text/event-stream"


async def test_proof_given_response_completed_expect_linked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        _assert_headers(request)
        return httpx.Response(200, text=_sse("response.completed", {}))

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.LINKED


async def test_proof_given_429_usage_limit_reached_expect_linked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            json={"error": {"type": "usage_limit_reached"}},
        )

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.LINKED


async def test_proof_given_429_usage_not_included_http_expect_terminal_ineligible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            json={"error": {"type": "usage_not_included"}},
        )

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TERMINAL_INELIGIBLE


async def test_proof_given_usage_not_included_in_stream_expect_terminal_ineligible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = _sse(
            "response.failed",
            {"response": {"error": {"code": "usage_not_included"}}},
        )
        return httpx.Response(200, text=body)

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TERMINAL_INELIGIBLE


async def test_proof_given_insufficient_quota_stream_expect_terminal_ineligible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = _sse(
            "response.failed",
            {"response": {"error": {"code": "insufficient_quota"}}},
        )
        return httpx.Response(200, text=body)

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TERMINAL_INELIGIBLE


async def test_proof_given_401_expect_authorization_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"code": "token_invalid"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.AUTHORIZATION_FAILED


async def test_proof_given_400_cyber_policy_expect_policy_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"code": "cyber_policy"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.POLICY_REJECTED


async def test_proof_given_400_context_length_stream_expect_invalid_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = _sse(
            "response.failed",
            {"response": {"error": {"code": "context_length_exceeded"}}},
        )
        return httpx.Response(200, text=body)

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.INVALID_REQUEST


async def test_proof_given_429_no_subtype_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "slow down"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_403_cloudflare_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="cloudflare blocked")

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_503_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": {"code": "server_is_overloaded"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_stream_disconnect_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=_sse("response.created", {}))

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_unrecognized_stream_code_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = _sse(
            "response.failed",
            {"response": {"error": {"code": "brand_new_unseen_code"}}},
        )
        return httpx.Response(200, text=body)

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_unrecognized_http_status_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(418, json={"error": {"code": "im_a_teapot"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_400_with_unrecognized_code_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": {"code": "strange_new_code"}})

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_network_error_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network down")

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT


async def test_proof_given_user_agent_missing_expect_cloudflare_530(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Documents the D-001 Cloudflare guard: default UA gets 530."""

    def handler(request: httpx.Request) -> httpx.Response:
        ua = request.headers.get("user-agent", "")
        if not ua or ua.startswith("python/"):
            return httpx.Response(530, text="cf_route_error")
        return httpx.Response(200, text=_sse("response.completed", {}))

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.LINKED


async def test_proof_given_uncoded_400_expect_model_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _stub(monkeypatch, lambda request: httpx.Response(400, json={}))

    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")

    assert verdict is ProofVerdict.MODEL_UNAVAILABLE


async def test_proof_given_stream_read_error_mid_body_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _FailingStream(httpx.AsyncByteStream):
        async def __aiter__(self):  # type: ignore[no-untyped-def]
            yield b"event: response.created\n\n"
            raise httpx.ReadError("connection dropped mid-stream")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=_FailingStream())

    _stub(monkeypatch, handler)
    verdict = await responses.prove_link(_credential(), "gpt-5.6-luna")
    assert verdict is ProofVerdict.TRANSIENT
