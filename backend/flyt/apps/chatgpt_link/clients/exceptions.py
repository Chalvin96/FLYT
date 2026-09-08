from flyt.apps.chatgpt_link.types import RenewalFailureClass


class ChatGPTAuthError(Exception):
    """Authorization-client failure. Never carries credential material."""


class UpstreamAuthError(ChatGPTAuthError):
    def __init__(self, status_code: int | None, code: str | None = None) -> None:
        self.status_code = status_code
        self.code = code
        super().__init__(
            f"OpenAI authorization call failed: status={status_code} code={code}"
        )


class RenewalFailedError(ChatGPTAuthError):
    def __init__(
        self,
        classification: RenewalFailureClass,
        code: str | None,
        status_code: int | None,
    ) -> None:
        self.classification = classification
        self.code = code
        self.status_code = status_code
        super().__init__(
            f"ChatGPT credential renewal failed: {classification} "
            f"(status={status_code} code={code})"
        )
