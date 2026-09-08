import asyncio
import json
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import AsyncMock
from unittest.mock import patch

import httpx
import pytest

from flyt.apps.chatgpt_link.models import ChatGPTLinkState
from flyt.clients.chatgpt import ChatGPTProvider
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.registry import ProviderRegistry

pytestmark = pytest.mark.anyio

_FIXTURES = Path(__file__).parent.parent / "fixtures" / "story_generation"
EXPECTED_PLAIN_PROMPT_TOKENS = 151
EXPECTED_PLAIN_COMPLETION_TOKENS = 102
EXPECTED_REASONING_COMPLETION_TOKENS = 363


async def test_openrouter_provider_given_explicit_policy_expect_feature_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.clients import openrouter

    monkeypatch.setattr(
        openrouter.settings,
        "STORY_GENERATION_OPENROUTER_REASONING_ENABLED",
        True,
    )
    provider = OpenRouterProvider(
        model="openai/gpt-5.6-luna",
        reasoning_enabled=False,
    )

    with _patched_post(
        response=_openrouter_response(200, _load_fixture("success_plain.json"))
    ) as client:
        await provider.generate(user_id=1, request=_request())

    payload = client.post.call_args.kwargs["json"]
    assert payload["model"] == "openai/gpt-5.6-luna"
    assert payload["reasoning"] == {"enabled": False}


async def test_openrouter_provider_given_reasoning_effort_expect_payload_reflects_setting() -> (
    None
):
    provider = OpenRouterProvider(reasoning_effort="low")

    with _patched_post(
        response=_openrouter_response(200, _load_fixture("success_plain.json"))
    ) as client:
        await provider.generate(user_id=1, request=_request())

    payload = client.post.call_args.kwargs["json"]
    assert payload["reasoning"] == {"effort": "low"}


def _load_fixture(name: str) -> dict:
    return json.loads((_FIXTURES / name).read_text())


def _openrouter_response(status_code: int, body: dict) -> httpx.Response:
    return httpx.Response(status_code=status_code, json=body)


@contextmanager
def _patched_post(*, response: httpx.Response, exc: Exception | None = None):
    with patch("flyt.clients.openrouter.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.post = AsyncMock(return_value=response, side_effect=exc)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value = client
        yield client


def _request(prompt: str = "A story about a cat.") -> GenerationRequest:
    return GenerationRequest(instructions="Write a story.", prompt=prompt)


async def test_openrouter_provider_given_success_plain_expect_text_and_tokens() -> None:
    """R-101: a feature requesting text receives it from the provider. R-106:
    token counts are recorded when the provider reports them."""
    body = _load_fixture("success_plain.json")
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, body)):
        result = await provider.generate(user_id=1, request=_request())

    assert result.text == body["choices"][0]["message"]["content"]
    assert result.prompt_tokens == EXPECTED_PLAIN_PROMPT_TOKENS
    assert result.completion_tokens == EXPECTED_PLAIN_COMPLETION_TOKENS
    assert result.cost == body["usage"]["cost"]
    assert result.reasoning_tokens == 0


async def test_openrouter_provider_given_reasoning_usage_expect_cost_and_reasoning_captured() -> (
    None
):
    """R-106: reasoning tokens are surfaced separately so the harness can show
    the completion billed at the reasoning rate."""
    body = _load_fixture("reasoning_on.json")
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, body)):
        result = await provider.generate(user_id=1, request=_request())

    assert result.cost == body["usage"]["cost"]
    assert (
        result.reasoning_tokens
        == body["usage"]["completion_tokens_details"]["reasoning_tokens"]
    )


async def test_openrouter_provider_given_usage_without_cost_expect_cost_none() -> None:
    """R-106: a provider response without a cost figure yields no cost, letting
    the harness fall back to pricing without inventing one."""
    body = _load_fixture("success_plain.json")
    body["usage"].pop("cost", None)
    body["usage"].pop("completion_tokens_details", None)
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, body)):
        result = await provider.generate(user_id=1, request=_request())

    assert result.cost is None
    assert result.reasoning_tokens is None


async def test_openrouter_provider_given_reasoning_on_expect_content_not_reasoning() -> (
    None
):
    """R-101/R-106: with reasoning enabled the returned text is the story, not
    the model's reasoning, and completion tokens count the full completion
    including the 135 reasoning tokens."""
    body = _load_fixture("reasoning_on.json")
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, body)):
        result = await provider.generate(user_id=1, request=_request())

    message = body["choices"][0]["message"]
    assert result.text == message["content"]
    assert message["reasoning"] not in result.text
    assert result.completion_tokens == EXPECTED_REASONING_COMPLETION_TOKENS


async def test_openrouter_provider_given_configured_model_expect_vendor_prefixed_in_payload() -> (
    None
):
    """R-105: the request carries the configured model id verbatim; sending a
    bare model name would 400 upstream."""
    from flyt.clients import openrouter

    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(200, _load_fixture("success_plain.json"))
    ) as client:
        await provider.generate(user_id=1, request=_request())

    payload = client.post.call_args.kwargs["json"]
    assert payload["model"] == openrouter.settings.STORY_GENERATION_OPENROUTER_MODEL


async def test_openrouter_provider_given_reasoning_enabled_expect_payload_reflects_setting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-105: reasoning enablement is configuration that flows to the request."""
    from flyt.clients import openrouter

    monkeypatch.setattr(
        openrouter.settings,
        "STORY_GENERATION_OPENROUTER_REASONING_ENABLED",
        True,
    )

    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(200, _load_fixture("success_plain.json"))
    ) as client:
        await provider.generate(user_id=1, request=_request())

    payload = client.post.call_args.kwargs["json"]
    assert payload["reasoning"] == {"enabled": True}


async def test_openrouter_provider_given_401_expect_authentication_failure() -> None:
    """R-104: a rejected credential is classified as authentication, not transient."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(401, {"error": {"code": "invalid_api_key"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.AUTHENTICATION
    assert exc_info.value.upstream_identifier == "invalid_api_key"


async def test_openrouter_provider_given_404_expect_model_unavailable_failure() -> None:
    """R-104: an unknown model is classified as model unavailable."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(404, {"error": {"code": "not_found"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.MODEL_UNAVAILABLE


async def test_openrouter_provider_given_413_expect_request_rejected_failure() -> None:
    """R-104: a request rejected for its size is classified as request rejected."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(
            413, {"error": {"code": "context_length_exceeded"}}
        )
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.REQUEST_REJECTED


async def test_openrouter_provider_given_403_expect_upstream_refusal_failure() -> None:
    """R-104: an upstream refusal is classified separately from a transient error."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(403, {"error": {"code": "content_policy"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.UPSTREAM_REFUSAL


async def test_openrouter_provider_given_500_expect_transient_failure() -> None:
    """R-104: a server error is classified as transient."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(500, {"error": {"code": "server_error"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT


async def test_openrouter_provider_given_504_expect_timeout_failure() -> None:
    """R-104: a gateway timeout is classified as a timeout."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(504, {"error": {"code": "gateway_timeout"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TIMEOUT


async def test_openrouter_provider_given_unmapped_status_expect_recorded_upstream_identifier() -> (
    None
):
    """R-104: an unmapped upstream failure is recorded with its identifier so the
    mapping can be corrected."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(418, {"error": {"code": "im_a_teapot"}})
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT
    assert exc_info.value.upstream_identifier == "im_a_teapot"


async def test_openrouter_provider_given_timeout_exception_expect_timeout_failure() -> (
    None
):
    """R-104: an upstream timeout surfaces as a timeout with no partial output."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(200, {}),
        exc=httpx.TimeoutException("timed out"),
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TIMEOUT


async def test_openrouter_provider_given_call_exceeds_deadline_expect_timeout_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The asyncio.timeout wall-clock ceiling fires independently of httpx's
    per-byte timeout and surfaces as a timeout-classified ProviderFailure."""
    from flyt.clients import openrouter

    monkeypatch.setattr(
        openrouter.settings,
        "STORY_GENERATION_OPENROUTER_TIMEOUT_SECONDS",
        0.01,
    )

    async def sleeping_post(*args: object, **kwargs: object) -> httpx.Response:
        await asyncio.sleep(10)
        return _openrouter_response(200, _load_fixture("success_plain.json"))

    provider = OpenRouterProvider()

    with patch("flyt.clients.openrouter.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.post = sleeping_post
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value = client

        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TIMEOUT


async def test_openrouter_provider_given_network_error_expect_transient_failure() -> (
    None
):
    """R-104: a transport error is classified as transient."""
    provider = OpenRouterProvider()

    with _patched_post(
        response=_openrouter_response(200, {}),
        exc=httpx.ConnectError("no connection"),
    ):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT


async def test_openrouter_provider_given_empty_choices_expect_failure_not_empty_text() -> (
    None
):
    """R-104: a failure never surfaces as empty or partial text."""
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, {"choices": []})):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT
    assert exc_info.value.upstream_identifier == "empty_choices"


async def test_openrouter_provider_given_empty_content_expect_classified_failure_not_empty_text() -> (
    None
):
    """R-104: HTTP 200 with empty content fails classified and never returns
    empty text as a story. Drives the derived fixture ``reasoning_empty_content.json``
    (content set to ``""`` on the captured reasoning_on.json; the empty-content
    failure is intermittent and could not be reproduced on demand)."""
    body = _load_fixture("reasoning_empty_content.json")
    provider = OpenRouterProvider()

    with _patched_post(response=_openrouter_response(200, body)):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT
    assert exc_info.value.upstream_identifier == "empty_content"


async def test_openrouter_provider_given_non_json_200_expect_transient_failure() -> (
    None
):
    """R-104: HTTP 200 with a non-JSON body is a classified failure, not a
    crash that escapes the failure taxonomy."""
    provider = OpenRouterProvider()

    with _patched_post(response=httpx.Response(200, content=b"<html>gateway</html>")):
        with pytest.raises(ProviderFailure) as exc_info:
            await provider.generate(user_id=1, request=_request())

    assert exc_info.value.failure_class is ProviderFailureClass.TRANSIENT
    assert exc_info.value.upstream_identifier == "non_json_body"


async def test_chatgpt_provider_given_no_link_expect_unavailable(db) -> None:
    """R-102: a learner without a linked credential is not offered the provider."""
    provider = ChatGPTProvider(db)

    availability = await provider.is_available(user_id=999)

    assert availability.available is False
    assert availability.reason == "not_linked"
    assert availability.action == "link_account"


async def test_chatgpt_provider_given_working_link_expect_available(db) -> None:
    """R-102: a learner with a working linked account can use the provider."""
    from tests.factories import ChatGPTLinkFactory
    from tests.factories import UserFactory

    user = await UserFactory.create_async()
    await ChatGPTLinkFactory.create_async(
        user_id=user.id, state=ChatGPTLinkState.WORKING
    )
    await db.flush()

    provider = ChatGPTProvider(db)
    availability = await provider.is_available(user.id)

    assert availability.available is True


async def test_chatgpt_provider_model_for_given_linked_model_key_expect_luna_default(  # ume-ignore: UME-PY003
    db,
) -> None:
    """ChatGPT linking always uses the configured Luna model."""
    from flyt.core.config import settings
    from tests.factories import ChatGPTLinkFactory
    from tests.factories import UserFactory

    user = await UserFactory.create_async()
    await ChatGPTLinkFactory.create_async(
        user_id=user.id,
        state=ChatGPTLinkState.WORKING,
        model_key="gpt-5.6-terra",
    )
    await db.flush()

    provider = ChatGPTProvider(db)

    assert await provider.model_for(user.id) == settings.CHATGPT_DEFAULT_MODEL
    assert provider.model == settings.CHATGPT_DEFAULT_MODEL


async def test_chatgpt_provider_model_for_given_no_link_expect_default_model(
    db,
) -> None:
    """R-105: without a linked selection the configured default is reported."""
    from flyt.core.config import settings

    provider = ChatGPTProvider(db)

    assert await provider.model_for(user_id=999) == settings.CHATGPT_DEFAULT_MODEL


async def test_chatgpt_provider_given_broken_link_expect_unavailable(db) -> None:
    """R-102: a broken linked credential is not offered, with a reason."""
    from tests.factories import ChatGPTLinkFactory
    from tests.factories import UserFactory

    user = await UserFactory.create_async()
    await ChatGPTLinkFactory.create_async(
        user_id=user.id,
        state=ChatGPTLinkState.BROKEN,
        broken_reason="refresh_token_reused",
    )
    await db.flush()

    provider = ChatGPTProvider(db)
    availability = await provider.is_available(user.id)

    assert availability.available is False
    assert "refresh_token_reused" in (availability.reason or "")


async def test_chatgpt_provider_generate_given_credential_unavailable_expect_auth_failure(
    db,
) -> None:
    """R-102: selecting a provider whose credential is absent fails with a reason
    distinct from an upstream error."""
    provider = ChatGPTProvider(db)

    with pytest.raises(ProviderFailure) as exc_info:
        await provider.generate(
            user_id=999,
            request=GenerationRequest(instructions="Write a story.", prompt="A story."),
        )

    assert exc_info.value.failure_class is ProviderFailureClass.AUTHENTICATION


async def test_provider_registry_given_disabled_in_config_expect_not_offered(
    db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-105: a provider disabled in configuration is not offered to learners."""
    from flyt.clients import registry

    monkeypatch.setattr(
        registry.settings,
        "STORY_GENERATION_ENABLED_PROVIDERS",
        ["chatgpt"],
    )

    registry = ProviderRegistry(db)
    offered = registry.offered()

    assert "openrouter" not in offered


async def test_stub_provider_given_resolve_and_generate_expect_canned_text_without_io(
    db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The stub serves the E2E flow like any other provider: offered, limited by
    Flyt, and returning text whose surface forms exist in the e2e lexicon."""
    from flyt.clients import registry

    monkeypatch.setattr(
        registry.settings,
        "STORY_GENERATION_ENABLED_PROVIDERS",
        ["stub"],
    )

    registry = ProviderRegistry(db)
    selection = await registry.resolve("stub", user_id=1)

    assert registry.offered() == ["stub"]
    assert selection.funded_by_flyt is True

    result = await selection.provider.generate(user_id=1, request=_request())

    assert result.text.strip()
    assert "bøkene" in result.text.lower()
    assert result.completion_tokens is not None
