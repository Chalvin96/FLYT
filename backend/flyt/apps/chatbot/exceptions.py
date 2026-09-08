from typing import ClassVar

from flyt.clients.provider import ProviderFailureClass
from flyt.core.exceptions import ConflictError
from flyt.core.exceptions import DomainException
from flyt.core.exceptions import ValidationError


class ChatbotModelUnavailableError(ConflictError):
    def __init__(
        self,
        model: str,
        reason: str | None = None,
        action: str | None = None,
    ) -> None:
        message = f"The {model} chatbot model is unavailable."
        if reason == "openrouter_key_required":
            message = "Add an OpenRouter key to use this model."
        elif action == "link_account":
            message = "Link your ChatGPT account to use this model."
        elif action == "relink_account":
            message = "Reconnect your ChatGPT account to use this model."
        elif reason in {"not_linked", "relink_account"}:
            message = "Link your ChatGPT account to use this model."
        super().__init__(
            message=message,
            code="CHATBOT_MODEL_UNAVAILABLE",
        )


class ChatbotQuotaExceededError(DomainException):
    status_code = 429

    def __init__(self) -> None:
        super().__init__(
            "This chatbot is unavailable right now. Try another model or try again later.",
            "CHATBOT_FLYT_QUOTA_EXCEEDED",
        )


class ChatbotCredentialStorageError(DomainException):
    status_code = 503

    def __init__(self) -> None:
        super().__init__(
            "OpenRouter key storage is not configured. Try again later.",
            "CHATBOT_CREDENTIAL_STORAGE_UNAVAILABLE",
        )


class ChatbotCredentialValidationError(ValidationError):
    def __init__(self) -> None:
        super().__init__(
            "OpenRouter key is invalid.",
            status_code=422,
            code="CHATBOT_INVALID_OPENROUTER_KEY",
        )


class ChatbotProviderError(DomainException):
    _DETAILS: ClassVar = {
        ProviderFailureClass.AUTHENTICATION: (
            502,
            "CHATBOT_PROVIDER_AUTHENTICATION",
            "The selected model could not authenticate. Check its connection or key.",
        ),
        ProviderFailureClass.TIMEOUT: (
            504,
            "CHATBOT_PROVIDER_TIMEOUT",
            "The selected model took too long to answer. Try again.",
        ),
        ProviderFailureClass.UPSTREAM_REFUSAL: (
            502,
            "CHATBOT_PROVIDER_REFUSED",
            "The selected model refused this request. Try another model or prompt.",
        ),
        ProviderFailureClass.REQUEST_REJECTED: (
            400,
            "CHATBOT_PROVIDER_REQUEST_REJECTED",
            "The selected model could not process this request.",
        ),
        ProviderFailureClass.MODEL_UNAVAILABLE: (
            502,
            "CHATBOT_PROVIDER_MODEL_UNAVAILABLE",
            "The selected model is temporarily unavailable. Try another model.",
        ),
        ProviderFailureClass.TRANSIENT: (
            503,
            "CHATBOT_PROVIDER_TRANSIENT",
            "The selected model could not answer right now. Try again.",
        ),
    }

    def __init__(self, failure_class: ProviderFailureClass) -> None:
        status_code, code, message = self._DETAILS[failure_class]
        super().__init__(message, code)
        self.status_code = status_code
