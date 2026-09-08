from flyt.apps.chatgpt_link.types import ChatGPTLinkErrorCode
from flyt.core.exceptions import DomainException


class ChatGPTLinkError(DomainException):
    """Base for every failure the link router translates."""


class ChatGPTLinkDisabledError(ChatGPTLinkError):
    status_code = 503

    def __init__(self) -> None:
        super().__init__(
            "ChatGPT linking is currently unavailable.",
            ChatGPTLinkErrorCode.DISABLED,
        )


class ChatGPTLinkIneligibleError(ChatGPTLinkError):
    status_code = 409

    def __init__(self) -> None:
        super().__init__(
            "Your ChatGPT plan does not include the usage Flyt needs.",
            ChatGPTLinkErrorCode.INELIGIBLE,
        )


class ChatGPTLinkModelUnavailableError(ChatGPTLinkError):
    status_code = 422

    def __init__(self) -> None:
        super().__init__(
            "That model is not available on your ChatGPT plan. Choose another.",
            ChatGPTLinkErrorCode.MODEL_UNAVAILABLE,
        )


class ChatGPTLinkTransientError(ChatGPTLinkError):
    """Anything the user resolves the same way: wait and try again."""

    status_code = 503

    def __init__(self) -> None:
        super().__init__(
            "ChatGPT could not be reached. Try again in a moment.",
            ChatGPTLinkErrorCode.TRANSIENT,
        )


class ChatGPTLinkPendingError(ChatGPTLinkError):
    status_code = 409

    def __init__(self) -> None:
        super().__init__(
            "No pending ChatGPT authorization to poll.",
            ChatGPTLinkErrorCode.NO_PENDING,
        )
