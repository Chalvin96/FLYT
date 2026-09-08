from typing import ClassVar

from flyt.clients.provider import ProviderFailureClass
from flyt.core.exceptions import DomainException
from flyt.core.exceptions import ValidationError


class ExtensionTranslationQuotaExceededError(DomainException):
    status_code = 429

    def __init__(self) -> None:
        super().__init__(
            "Translation is unavailable right now. Try again later.",
            "EXTENSION_TRANSLATION_QUOTA_EXCEEDED",
        )


class ExtensionTranslationValidationError(ValidationError):
    def __init__(self, message: str = "Select a shorter Norwegian sentence.") -> None:
        super().__init__(message, status_code=422, code="EXTENSION_TRANSLATION_INVALID")


class ExtensionTranslationProviderError(DomainException):
    _DETAILS: ClassVar = {
        ProviderFailureClass.AUTHENTICATION: (
            502,
            "EXTENSION_TRANSLATION_PROVIDER_AUTHENTICATION",
            "Translation is temporarily unavailable. Try again.",
        ),
        ProviderFailureClass.TIMEOUT: (
            504,
            "EXTENSION_TRANSLATION_PROVIDER_TIMEOUT",
            "Translation took too long. Try again.",
        ),
        ProviderFailureClass.UPSTREAM_REFUSAL: (
            502,
            "EXTENSION_TRANSLATION_PROVIDER_REFUSED",
            "Translation could not be completed. Try again.",
        ),
        ProviderFailureClass.REQUEST_REJECTED: (
            400,
            "EXTENSION_TRANSLATION_PROVIDER_REJECTED",
            "Translation could not be completed for this text.",
        ),
        ProviderFailureClass.MODEL_UNAVAILABLE: (
            502,
            "EXTENSION_TRANSLATION_PROVIDER_UNAVAILABLE",
            "Translation is temporarily unavailable. Try again.",
        ),
        ProviderFailureClass.TRANSIENT: (
            503,
            "EXTENSION_TRANSLATION_PROVIDER_TRANSIENT",
            "Translation is temporarily unavailable. Try again.",
        ),
    }

    def __init__(self, failure_class: ProviderFailureClass) -> None:
        status_code, code, message = self._DETAILS[failure_class]
        super().__init__(message, code)
        self.status_code = status_code
