from contextlib import asynccontextmanager
from typing import Any
from collections.abc import AsyncIterator

import httpx
from pydantic import SecretStr

from flyt.apps.chatgpt_link.clients import config
from flyt.apps.chatgpt_link.clients.exceptions import UpstreamAuthError
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.core.config import settings


class ProviderApi:
    def http_client(
        self, timeout: float, headers: dict[str, str] | None = None
    ) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": config.USER_AGENT, **(headers or {})},
        )


class ChatGPTAuthApi(ProviderApi):
    async def usercode(self) -> httpx.Response:
        return await self._post(
            config.USERCODE_URL, json_body={"client_id": config.CLIENT_ID}
        )

    async def device_token(self, device_auth_id: str, user_code: str) -> httpx.Response:
        return await self._post(
            config.DEVICE_TOKEN_URL,
            json_body={"device_auth_id": device_auth_id, "user_code": user_code},
        )

    async def exchange(
        self, authorization_code: SecretStr, code_verifier: SecretStr
    ) -> httpx.Response:
        return await self._post(
            config.TOKEN_URL,
            form_body={
                "grant_type": "authorization_code",
                "code": authorization_code.get_secret_value(),
                "redirect_uri": config.DEVICE_REDIRECT_URI,
                "client_id": config.CLIENT_ID,
                "code_verifier": code_verifier.get_secret_value(),
            },
        )

    async def renew(self, refresh_token: SecretStr) -> httpx.Response:
        return await self._post(
            config.TOKEN_URL,
            json_body={
                "client_id": config.CLIENT_ID,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token.get_secret_value(),
            },
        )

    async def revoke(self, refresh_token: SecretStr) -> httpx.Response:
        return await self._post(
            config.REVOKE_URL,
            json_body={
                "token": refresh_token.get_secret_value(),
                "token_type_hint": "refresh_token",
                "client_id": config.CLIENT_ID,
            },
            request_timeout=config.REVOKE_TIMEOUT_SECONDS,
        )

    async def _post(
        self,
        url: str,
        *,
        json_body: dict[str, Any] | None = None,
        form_body: dict[str, str] | None = None,
        request_timeout: float | None = None,
    ) -> httpx.Response:
        try:
            async with self.http_client(
                request_timeout or settings.CHATGPT_AUTH_TIMEOUT_SECONDS
            ) as client:
                if form_body is not None:
                    return await client.post(url, data=form_body)
                return await client.post(url, json=json_body or {})
        except httpx.HTTPError as exc:
            raise UpstreamAuthError(None) from exc


class ChatGPTResponsesApi(ProviderApi):
    @asynccontextmanager
    async def stream_proof(
        self, credential: ChatGPTCredential, model: str
    ) -> AsyncIterator[httpx.Response]:
        async with self.http_client(
            settings.CHATGPT_MODEL_TIMEOUT_SECONDS,
            headers=self._proof_headers(credential),
        ) as client:
            async with client.stream(
                "POST", config.RESPONSES_URL, json=self._proof_payload(model)
            ) as response:
                yield response

    @staticmethod
    def _proof_headers(credential: ChatGPTCredential) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {credential.access_token.get_secret_value()}",
            "ChatGPT-Account-Id": credential.chatgpt_account_id,
            "OpenAI-Beta": "responses=experimental",
            "Accept": "text/event-stream",
            "originator": config.ORIGINATOR,
        }

    @staticmethod
    def _proof_payload(model: str) -> dict[str, Any]:
        return {
            "model": model,
            "instructions": config.PROOF_INSTRUCTIONS,
            "input": [
                {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": config.PROOF_INPUT_TEXT}
                    ],
                }
            ],
            "store": False,
            "stream": True,
        }
