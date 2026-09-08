"""OpenRouter transport for Flyt-owned text generation."""

import asyncio
from collections.abc import Awaitable
from collections.abc import Callable
from http import HTTPStatus
from typing import Any
from typing import Literal

import httpx

from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.provider import _raise_provider_failure
from flyt.clients.provider import _safe_float
from flyt.clients.provider import _safe_int
from flyt.core.config import settings

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider(ModelProvider):
    """OpenRouter transport shared by every Flyt-owned model feature.

    Story generation uses the story model, reasoning, and timeout defaults;
    other model features can override those values while transport and failure
    classification stay identical.
    """

    def __init__(
        self,
        *,
        model: str | None = None,
        reasoning_enabled: bool | None = None,
        reasoning_effort: Literal["max", "high", "medium", "low", "minimal", "none"]
        | None = None,
        timeout_seconds: float | None = None,
        api_key_resolver: Callable[[int], Awaitable[str | None]] | None = None,
    ) -> None:
        self._api_key = settings.OPENROUTER_API_KEY
        self._api_key_resolver = api_key_resolver
        self._model = (
            model if model is not None else settings.STORY_GENERATION_OPENROUTER_MODEL
        )
        self._timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.STORY_GENERATION_OPENROUTER_TIMEOUT_SECONDS
        )
        self._reasoning_enabled = (
            reasoning_enabled
            if reasoning_enabled is not None
            else settings.STORY_GENERATION_OPENROUTER_REASONING_ENABLED
        )
        self._reasoning_effort = reasoning_effort

    @property
    def name(self) -> str:
        return "openrouter"

    @property
    def model(self) -> str:
        return self._model

    async def is_available(self, user_id: int) -> ProviderAvailability:
        return self.availability_for_preloaded_key(
            bool(await self._load_api_key(user_id))
        )

    def availability_for_preloaded_key(
        self, learner_key_present: bool
    ) -> ProviderAvailability:
        """Classify availability from an already-loaded credential read.

        Providers with a learner-key resolver classify the preloaded key
        presence; static-key providers keep classifying their configured key,
        so a caller holding a snapshot never re-resolves the credential.
        """
        has_key = (
            learner_key_present
            if self._api_key_resolver is not None
            else bool(self._api_key)
        )
        if has_key:
            return ProviderAvailability(available=True)
        if self._api_key_resolver is not None:
            return ProviderAvailability(
                available=False,
                reason="openrouter_key_required",
                action="add_openrouter_key",
            )
        return ProviderAvailability(
            available=False,
            reason="not_configured",
            action="contact_support",
        )

    async def generate(
        self,
        user_id: int,
        request: GenerationRequest,
    ) -> GenerationResult:
        api_key = await self._load_api_key(user_id)
        if not api_key:
            raise ProviderFailure(
                ProviderFailureClass.AUTHENTICATION,
                "OpenRouter API key is not configured",
            )

        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": request.instructions},
                {"role": "user", "content": request.prompt},
            ],
            "reasoning": (
                {"effort": self._reasoning_effort}
                if self._reasoning_effort is not None
                else {"enabled": self._reasoning_enabled}
            ),
        }
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with asyncio.timeout(self._timeout_seconds):
                async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                    response = await client.post(
                        OPENROUTER_BASE_URL, json=payload, headers=headers
                    )
                    if response.status_code != HTTPStatus.OK:
                        _raise_provider_failure(response, "OpenRouter")
                    return self._parse_response(response)
        except TimeoutError as exc:
            raise ProviderFailure(
                ProviderFailureClass.TIMEOUT, "OpenRouter request timed out"
            ) from exc
        except httpx.TimeoutException as exc:
            raise ProviderFailure(
                ProviderFailureClass.TIMEOUT, "OpenRouter request timed out"
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT, "OpenRouter network error"
            ) from exc

    async def _load_api_key(self, user_id: int) -> str | None:
        if self._api_key_resolver is not None:
            return await self._api_key_resolver(user_id)
        return self._api_key

    @staticmethod
    def _parse_response(response: httpx.Response) -> GenerationResult:
        try:
            body = response.json()
        except ValueError:
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT,
                "OpenRouter returned a non-JSON body",
                upstream_identifier="non_json_body",
            ) from None
        choices = body.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT,
                "OpenRouter returned no choices",
                upstream_identifier="empty_choices",
            )
        text: str | None = None
        for choice in choices:
            message = choice.get("message") if isinstance(choice, dict) else None
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str) and content.strip():
                    text = content
                    break
        usage = body.get("usage")
        return OpenRouterProvider._result_from_content(text, usage)

    @staticmethod
    def _result_from_content(text: str | None, usage: Any) -> GenerationResult:
        if not text or not text.strip():
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT,
                "OpenRouter returned empty content",
                upstream_identifier="empty_content",
            )
        prompt_tokens = completion_tokens = None
        cost = reasoning_tokens = None
        if isinstance(usage, dict):
            prompt_tokens = _safe_int(usage.get("prompt_tokens"))
            completion_tokens = _safe_int(usage.get("completion_tokens"))
            cost = _safe_float(usage.get("cost"))
            completion_details = usage.get("completion_tokens_details")
            if isinstance(completion_details, dict):
                reasoning_tokens = _safe_int(completion_details.get("reasoning_tokens"))
        return GenerationResult(
            text=text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost=cost,
            reasoning_tokens=reasoning_tokens,
        )
