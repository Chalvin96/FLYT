from flyt.core.exceptions import DomainException


class AuthenticationError(DomainException):
    def __init__(self, message: str):
        super().__init__(message, "AUTHENTICATION_FAILED")
