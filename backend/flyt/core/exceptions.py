class DomainException(Exception):
    # Subclasses set their own HTTP status; 500 is the fail-safe for any that don't.
    status_code: int = 500

    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(message)


class ConflictError(DomainException):
    def __init__(
        self,
        message: str = "Conflict",
        code: str = "CONFLICT",
        status_code: int = 409,
    ):
        super().__init__(message, code)
        self.status_code = status_code


class ValidationError(DomainException):
    def __init__(
        self, message: str, status_code: int = 400, code: str = "VALIDATION_ERROR"
    ):
        super().__init__(message, code)
        self.status_code = status_code


class NotFoundError(DomainException):
    def __init__(self, message: str, code: str = "NOT_FOUND"):
        super().__init__(message, code)
        self.status_code = 404
