class SttServiceError(Exception):
    """Base error for the internal speech-to-text client."""


class SttServiceNotConfiguredError(SttServiceError):
    """Raised when the internal STT service URL is not configured."""


class SttServiceTransportError(SttServiceError):
    """Raised when the backend cannot complete an STT request."""


class SttServiceResponseError(SttServiceError):
    """Raised when the STT service rejects a request."""

    def __init__(self, status_code: int, retry_after: str | None = None) -> None:
        super().__init__(f"STT service returned HTTP {status_code}")
        self.status_code = status_code
        self.retry_after = retry_after


class SttServicePayloadError(SttServiceError):
    """Raised when a successful STT response does not match its contract."""
