from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from pydantic import SecretStr


class ChatGPTLinkErrorCode(StrEnum):
    DISABLED = "CHATGPT_LINK_DISABLED"
    INELIGIBLE = "CHATGPT_LINK_INELIGIBLE"
    MODEL_UNAVAILABLE = "CHATGPT_LINK_MODEL_UNAVAILABLE"
    TRANSIENT = "CHATGPT_LINK_TRANSIENT"
    NO_PENDING = "CHATGPT_LINK_NO_PENDING"


class ProofVerdict(StrEnum):
    LINKED = "linked"
    TERMINAL_INELIGIBLE = "terminal_ineligibility"
    AUTHORIZATION_FAILED = "authorization_failed"
    INVALID_REQUEST = "invalid_request"
    POLICY_REJECTED = "policy_rejected"
    TRANSIENT = "transient"
    MODEL_UNAVAILABLE = "model_unavailable"


class RenewalFailureClass(StrEnum):
    PERMANENT = "permanent"
    TRANSIENT = "transient"


@dataclass(frozen=True)
class DeviceAuthorization:
    device_auth_id: str
    user_code: str
    expires_at: datetime


@dataclass(frozen=True)
class DevicePollPending:
    pass


@dataclass(frozen=True)
class DevicePollApproved:
    authorization_code: SecretStr
    code_verifier: SecretStr


DevicePollOutcome = DevicePollPending | DevicePollApproved


@dataclass(frozen=True)
class ChatGPTCredential:
    access_token: SecretStr
    refresh_token: SecretStr
    chatgpt_account_id: str
    access_token_expires_at: datetime


@dataclass(frozen=True)
class RenewedCredential:
    access_token: SecretStr
    refresh_token_or_keep_stored: SecretStr | None
    access_token_expires_at: datetime


@dataclass(frozen=True)
class PendingAuthorization:
    device_auth_id: str
    user_code: str
    expires_at: datetime
    model_key: str | None = None

    @classmethod
    def of(
        cls, device: DeviceAuthorization, model_key: str | None
    ) -> "PendingAuthorization":
        return cls(
            device_auth_id=device.device_auth_id,
            user_code=device.user_code,
            expires_at=device.expires_at,
            model_key=model_key,
        )
