"""ChatGPT transport backed by a learner's linked account."""

import asyncio
from http import HTTPStatus
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.chatgpt_link.clients import config as chatgpt_config
from flyt.apps.chatgpt_link.clients.api import ProviderApi
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.chatgpt_link.models import ChatGPTLinkState
from flyt.apps.chatgpt_link.rotation import renew_if_needed
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.provider import _raise_provider_failure
from flyt.clients.provider import _safe_int
from flyt.core.config import settings


class _ChatGPTGenerationApi(ProviderApi):
    async def complete(
        self,
        credential: ChatGPTCredential,
        model: str,
        request: GenerationRequest,
        request_timeout: float,
    ) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {credential.access_token.get_secret_value()}",
            "ChatGPT-Account-Id": credential.chatgpt_account_id,
            "OpenAI-Beta": "responses=experimental",
            "originator": chatgpt_config.ORIGINATOR,
        }
        payload: dict[str, Any] = {
            "model": model,
            "instructions": request.instructions,
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": request.prompt}],
                }
            ],
            "store": False,
            "stream": False,
        }
        if request.max_tokens is not None:
            payload["max_output_tokens"] = request.max_tokens

        async with self.http_client(request_timeout, headers=headers) as client:
            return await client.post(chatgpt_config.RESPONSES_URL, json=payload)


class ChatGPTProvider(ModelProvider):
    def __init__(
        self,
        db: AsyncSession,
        timeout_seconds: float | None = None,
    ) -> None:
        self._db = db
        self._api = _ChatGPTGenerationApi()
        self._timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.STORY_GENERATION_CHATGPT_TIMEOUT_SECONDS
        )

    @property
    def name(self) -> str:
        return "chatgpt"

    @property
    def model(self) -> str:
        return settings.CHATGPT_DEFAULT_MODEL

    async def model_for(self, user_id: int) -> str:
        return self.model

    async def is_available(self, user_id: int) -> ProviderAvailability:
        link = await self._db.scalar(
            select(ChatGPTLink).where(ChatGPTLink.user_id == user_id)
        )
        if link is None:
            return ProviderAvailability(
                available=False, reason="not_linked", action="link_account"
            )
        if link.state is ChatGPTLinkState.BROKEN:
            return ProviderAvailability(
                available=False,
                reason=link.broken_reason or "broken",
                action="relink_account",
            )
        return ProviderAvailability(available=True)

    async def generate(
        self,
        user_id: int,
        request: GenerationRequest,
    ) -> GenerationResult:
        link = await self._db.scalar(
            select(ChatGPTLink).where(ChatGPTLink.user_id == user_id)
        )
        if link is None or link.state is ChatGPTLinkState.BROKEN:
            raise ProviderFailure(
                ProviderFailureClass.AUTHENTICATION,
                "ChatGPT credential not available",
            )

        chosen_model = self.model

        credential = await renew_if_needed(user_id)
        if credential is None:
            raise ProviderFailure(
                ProviderFailureClass.AUTHENTICATION,
                "ChatGPT credential renewal failed",
            )

        try:
            async with asyncio.timeout(self._timeout_seconds):
                response = await self._api.complete(
                    credential,
                    chosen_model,
                    request,
                    self._timeout_seconds,
                )
        except TimeoutError as exc:
            raise ProviderFailure(
                ProviderFailureClass.TIMEOUT, "ChatGPT request timed out"
            ) from exc
        except httpx.TimeoutException as exc:
            raise ProviderFailure(
                ProviderFailureClass.TIMEOUT, "ChatGPT request timed out"
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT, "ChatGPT network error"
            ) from exc

        if response.status_code != HTTPStatus.OK:
            _raise_provider_failure(response, "ChatGPT")

        return self._parse_response(response, chosen_model)

    @staticmethod
    def _parse_response(response: httpx.Response, model: str) -> GenerationResult:
        try:
            body = response.json()
        except ValueError:
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT,
                "ChatGPT returned a non-JSON body",
                upstream_identifier="non_json_body",
            ) from None
        text = _extract_chatgpt_text(body)
        if not text or not text.strip():
            raise ProviderFailure(
                ProviderFailureClass.TRANSIENT,
                "ChatGPT returned empty content",
                upstream_identifier="empty_content",
            )
        usage = body.get("usage")
        prompt_tokens = completion_tokens = None
        if isinstance(usage, dict):
            prompt_tokens = _safe_int(usage.get("input_tokens"))
            completion_tokens = _safe_int(usage.get("output_tokens"))
        return GenerationResult(
            text=text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )


def _extract_chatgpt_text(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    output = body.get("output")
    if isinstance(output, list):
        output_text = _extract_output_text(output)
        if output_text:
            return output_text
    text = body.get("output_text")
    if isinstance(text, str):
        return text
    return None


def _extract_output_text(output: list[Any]) -> str | None:
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                return text
    return None
