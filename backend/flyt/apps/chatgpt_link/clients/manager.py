import base64
import json
import logging
from datetime import datetime
from datetime import timedelta
from datetime import UTC
from http import HTTPStatus
from typing import Any

import httpx
from pydantic import SecretStr

from flyt.apps.chatgpt_link.clients import config
from flyt.apps.chatgpt_link.clients.api import ChatGPTAuthApi
from flyt.apps.chatgpt_link.clients.api import ChatGPTResponsesApi
from flyt.apps.chatgpt_link.clients.exceptions import ChatGPTAuthError
from flyt.apps.chatgpt_link.clients.exceptions import RenewalFailedError
from flyt.apps.chatgpt_link.clients.exceptions import UpstreamAuthError
from flyt.apps.chatgpt_link.clients.types import ErrorResponse
from flyt.apps.chatgpt_link.types import ChatGPTCredential
from flyt.apps.chatgpt_link.types import DeviceAuthorization
from flyt.apps.chatgpt_link.types import DevicePollApproved
from flyt.apps.chatgpt_link.types import DevicePollOutcome
from flyt.apps.chatgpt_link.types import DevicePollPending
from flyt.apps.chatgpt_link.types import ProofVerdict
from flyt.apps.chatgpt_link.types import RenewalFailureClass
from flyt.apps.chatgpt_link.types import RenewedCredential
from flyt.libs.utils.date import now

logger = logging.getLogger(__name__)


class ChatGPTAuthManager:
    def __init__(self, api: ChatGPTAuthApi | None = None) -> None:
        self._api = api or ChatGPTAuthApi()

    async def request_device_authorization(self) -> DeviceAuthorization:
        response = await self._api.usercode()
        if response.status_code != HTTPStatus.OK:
            logger.info(
                "[chatgpt-link] usercode failed: status=%s code=%s",
                response.status_code,
                ErrorResponse.parse(response.text).first,
            )
            raise UpstreamAuthError(
                response.status_code, ErrorResponse.parse(response.text).first
            )

        payload = response.json()
        expires_raw = payload.get("expires_at")
        if isinstance(expires_raw, str):
            expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
            expires_at = expires_at.astimezone(UTC).replace(tzinfo=None)
        else:
            expires_at = now() + timedelta(minutes=10)
        return DeviceAuthorization(
            device_auth_id=payload["device_auth_id"],
            user_code=payload.get("user_code") or payload["usercode"],
            expires_at=expires_at,
        )

    async def poll_device_authorization(
        self, device_auth_id: str, user_code: str
    ) -> DevicePollOutcome:
        response = await self._api.device_token(device_auth_id, user_code)
        if response.status_code == HTTPStatus.OK:
            return self._approval_or_raise(response.json())
        if response.status_code in (403, 404):
            return DevicePollPending()
        logger.info(
            "[chatgpt-link] device token poll failed: status=%s code=%s",
            response.status_code,
            ErrorResponse.parse(response.text).first,
        )
        raise UpstreamAuthError(
            response.status_code, ErrorResponse.parse(response.text).first
        )

    async def exchange_authorization_code(
        self, approval: DevicePollApproved
    ) -> ChatGPTCredential:
        response = await self._api.exchange(
            approval.authorization_code, approval.code_verifier
        )
        if response.status_code != HTTPStatus.OK:
            logger.info(
                "[chatgpt-link] token exchange failed: status=%s code=%s",
                response.status_code,
                ErrorResponse.parse(response.text).first,
            )
            raise UpstreamAuthError(
                response.status_code, ErrorResponse.parse(response.text).first
            )

        tokens = response.json()
        issued_refresh_token = self._refresh_token_or_none(tokens.get("refresh_token"))
        try:
            return self._credential_or_raise(tokens)
        except ChatGPTAuthError:
            if issued_refresh_token is not None:
                await self.revoke_refresh_token(issued_refresh_token)
            raise

    async def renew_credential(self, refresh_token: SecretStr) -> RenewedCredential:
        response = await self._api.renew(refresh_token)
        if response.status_code != HTTPStatus.OK:
            codes = ErrorResponse.parse(response.text)
            classification = self.classify_renewal_failure(response.status_code, codes)
            code = codes.first_in(config.PERMANENT_RENEWAL_CODES) or codes.first
            logger.info(
                "[chatgpt-link] renewal failed: status=%s code=%s class=%s",
                response.status_code,
                code,
                classification,
            )
            raise RenewalFailedError(classification, code, response.status_code)

        return self._renewed_or_raise(response.json())

    async def revoke_refresh_token(self, refresh_token: SecretStr) -> None:
        try:
            response = await self._api.revoke(refresh_token)
        except UpstreamAuthError:
            logger.info("[chatgpt-link] revoke unreachable; disposing locally anyway")
            return
        logger.info("[chatgpt-link] revoke answered: status=%s", response.status_code)

    @staticmethod
    def classify_renewal_failure(
        status_code: int | None, codes: ErrorResponse
    ) -> RenewalFailureClass:
        if (
            status_code == HTTPStatus.UNAUTHORIZED
            or codes.first_in(config.PERMANENT_RENEWAL_CODES) is not None
        ):
            return RenewalFailureClass.PERMANENT
        return RenewalFailureClass.TRANSIENT

    @staticmethod
    def _refresh_token_or_none(refresh_token: Any) -> SecretStr | None:
        """The parameter name must stay denylisted: a bare token here reaches Sentry."""
        if not isinstance(refresh_token, str) or not refresh_token:
            return None
        return SecretStr(refresh_token)

    @staticmethod
    def _jwt_claims(token: SecretStr) -> dict[str, Any]:
        payload = token.get_secret_value().split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))

    @classmethod
    def _access_token_expiry(cls, access_token: SecretStr) -> datetime:
        fallback = now() + config.TOKEN_EXPIRY_FALLBACK
        try:
            claims = cls._jwt_claims(access_token)
        except (ValueError, IndexError, KeyError, TypeError):
            return fallback
        exp = claims.get("exp")
        if not isinstance(exp, (int, float)):
            return fallback
        return datetime.fromtimestamp(exp, tz=UTC).replace(tzinfo=None)

    @classmethod
    def _chatgpt_account_id_or_raise(cls, id_token: SecretStr) -> str:
        claims = cls._jwt_claims(id_token)
        auth_claims = claims.get("https://api.openai.com/auth") or {}
        account_id = auth_claims.get("chatgpt_account_id")
        if not account_id:
            raise ChatGPTAuthError("id_token carries no chatgpt_account_id claim")
        return str(account_id)

    @staticmethod
    def _approval_or_raise(payload: dict[str, Any]) -> DevicePollApproved:
        """Wrap before anything can raise: a bare secret in a frame local reaches Sentry."""
        try:
            authorization_code = SecretStr(payload["authorization_code"])
            code_verifier = SecretStr(payload["code_verifier"])
        except KeyError as exc:
            raise ChatGPTAuthError(
                f"device poll response missing {exc.args[0]}"
            ) from None
        finally:
            payload.clear()
        return DevicePollApproved(
            authorization_code=authorization_code, code_verifier=code_verifier
        )

    @classmethod
    def _credential_or_raise(cls, tokens: dict[str, Any]) -> ChatGPTCredential:
        """Wrap before anything can raise: a bare token in a frame local reaches Sentry."""
        try:
            access_token = SecretStr(tokens["access_token"])
            refresh_token = SecretStr(tokens["refresh_token"])
            id_token = SecretStr(tokens["id_token"])
        except KeyError as exc:
            raise ChatGPTAuthError(f"token response missing {exc.args[0]}") from None
        finally:
            tokens.clear()
        return ChatGPTCredential(
            access_token=access_token,
            refresh_token=refresh_token,
            chatgpt_account_id=cls._chatgpt_account_id_or_raise(id_token),
            access_token_expires_at=cls._access_token_expiry(access_token),
        )

    @classmethod
    def _renewed_or_raise(cls, tokens: dict[str, Any]) -> RenewedCredential:
        try:
            access_token = SecretStr(tokens["access_token"])
            refresh_token = cls._refresh_token_or_none(tokens.get("refresh_token"))
        except KeyError as exc:
            raise ChatGPTAuthError(f"renewal response missing {exc.args[0]}") from None
        finally:
            tokens.clear()
        return RenewedCredential(
            access_token=access_token,
            refresh_token_or_keep_stored=refresh_token,
            access_token_expires_at=cls._access_token_expiry(access_token),
        )


class ChatGPTResponsesManager:
    def __init__(self, api: ChatGPTResponsesApi | None = None) -> None:
        self._api = api or ChatGPTResponsesApi()

    async def prove_link(
        self, credential: ChatGPTCredential, model: str
    ) -> ProofVerdict:
        try:
            async with self._api.stream_proof(credential, model) as response:
                if response.status_code != HTTPStatus.OK:
                    body = (await response.aread()).decode("utf-8", "replace")
                    verdict = self._classify_http(response.status_code, body)
                    codes = ErrorResponse.parse(body)
                    code = (
                        codes.first_in(config.VERDICT_BY_UPSTREAM_CODE) or codes.first
                    )
                    logger.info(
                        "[chatgpt-link] proof http failure: model=%s status=%s code=%s verdict=%s",
                        model,
                        response.status_code,
                        code,
                        verdict,
                    )
                    return verdict
                return await self._read_stream(response)
        except httpx.HTTPError:
            logger.info("[chatgpt-link] proof call network error: model=%s", model)
            return ProofVerdict.TRANSIENT

    @classmethod
    async def _read_stream(cls, response: httpx.Response) -> ProofVerdict:
        event_type: str | None = None
        data_parts: list[str] = []
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_parts.append(line[5:].lstrip())
            elif line == "":
                if event_type == "response.completed":
                    return ProofVerdict.LINKED
                if event_type == "response.failed":
                    code = cls._stream_error_code("".join(data_parts))
                    verdict = cls._classify_stream_code(code)
                    logger.info(
                        "[chatgpt-link] proof stream failure: code=%s verdict=%s",
                        code,
                        verdict,
                    )
                    return verdict
                event_type = None
                data_parts = []
        logger.info(
            "[chatgpt-link] proof stream ended without response.completed or response.failed"
        )
        return ProofVerdict.TRANSIENT

    @staticmethod
    def _classify_http(status_code: int, body: str) -> ProofVerdict:
        if status_code == HTTPStatus.UNAUTHORIZED:
            return ProofVerdict.AUTHORIZATION_FAILED

        codes = ErrorResponse.parse(body)
        known = codes.first_in(config.VERDICT_BY_UPSTREAM_CODE)
        if known is not None:
            return config.VERDICT_BY_UPSTREAM_CODE[known]
        if status_code == HTTPStatus.BAD_REQUEST and not codes:
            return ProofVerdict.MODEL_UNAVAILABLE
        return ProofVerdict.TRANSIENT

    @staticmethod
    def _classify_stream_code(code: str | None) -> ProofVerdict:
        if code is None:
            return ProofVerdict.TRANSIENT
        return config.VERDICT_BY_UPSTREAM_CODE.get(code, ProofVerdict.TRANSIENT)

    @staticmethod
    def _stream_error_code(data: str) -> str | None:
        try:
            payload = json.loads(data)
        except ValueError:
            return None
        if not isinstance(payload, dict):
            return None
        for source in (payload.get("response"), payload):
            if not isinstance(source, dict):
                continue
            error = source.get("error")
            if (
                isinstance(error, dict)
                and isinstance(code := error.get("code"), str)
                and code
            ):
                return code
        return None


auth = ChatGPTAuthManager()
responses = ChatGPTResponsesManager()
