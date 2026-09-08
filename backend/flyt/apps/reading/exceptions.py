from flyt.core.exceptions import ConflictError
from flyt.core.exceptions import NotFoundError
from flyt.core.exceptions import ValidationError


class ReadingNotFoundError(NotFoundError):
    def __init__(self, message: str):
        super().__init__(message)


class ReadingNotReadyError(ConflictError):
    """An imported story exists for the caller but is not finished processing.

    Distinct from not-found: the caller owns it, so the reader signals "keep polling"
    (HTTP 409) rather than hiding it.
    """

    def __init__(self, status_value: str) -> None:
        super().__init__("Import is not ready", code="IMPORT_NOT_READY")
        self.status_value = status_value


# Persistent import models and contracts


class ImportEmptyError(ValidationError):
    def __init__(self, message: str = "Text is empty.") -> None:
        super().__init__(message, status_code=422, code="IMPORT_EMPTY")


class ImportTooLargeError(ValidationError):
    def __init__(self, message: str = "Text exceeds the size limit.") -> None:
        super().__init__(message, status_code=413, code="IMPORT_TOO_LARGE")


class ImportInvalidSourceUrlError(ValidationError):
    def __init__(self, message: str = "source_url is not valid.") -> None:
        super().__init__(message, status_code=422, code="IMPORT_INVALID_SOURCE_URL")


class ImportQuotaExceededError(ValidationError):
    def __init__(self, message: str = "Import limit reached.") -> None:
        super().__init__(message, status_code=429, code="IMPORT_QUOTA_EXCEEDED")


class ImportInvalidCursorError(ValidationError):
    def __init__(self, message: str = "Invalid cursor.") -> None:
        super().__init__(message, status_code=422, code="IMPORT_INVALID_CURSOR")


class ImportNotFoundError(NotFoundError):
    def __init__(self, message: str = "Import not found.") -> None:
        super().__init__(message, code="IMPORT_NOT_FOUND")


class ImportNotRetryableError(ConflictError):
    def __init__(self, message: str = "Import is not in a retryable state.") -> None:
        super().__init__(message, code="IMPORT_NOT_RETRYABLE")
