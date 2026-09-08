from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.core.exceptions import DomainException


class GenerationRefused(DomainException):
    def __init__(
        self,
        code: str,
        message: str,
    ):
        super().__init__(message, code)
        self.status_code = 422


class AnchorExhaustedRefused(GenerationRefused):
    def __init__(self, message: str = "The chosen anchor has nothing left to teach."):
        super().__init__(StoryGenerationErrorCode.ANCHOR_NOTHING_TO_TEACH, message)


class TopicTooLongRefused(GenerationRefused):
    def __init__(self, message: str = "Topic exceeds the maximum length."):
        super().__init__(StoryGenerationErrorCode.TOPIC_TOO_LONG, message)


class LengthOutOfRangeRefused(GenerationRefused):
    def __init__(self, message: str = "Length is outside the supported range."):
        super().__init__(StoryGenerationErrorCode.LENGTH_OUT_OF_RANGE, message)


class WeeklyBudgetExhaustedRefused(GenerationRefused):
    def __init__(self, message: str = "This story could not be started right now."):
        super().__init__(StoryGenerationErrorCode.ALLOWANCE_EXHAUSTED, message)


class ProviderUnavailableRefused(GenerationRefused):
    def __init__(self, message: str = "Provider is unavailable."):
        super().__init__(StoryGenerationErrorCode.PROVIDER_UNAVAILABLE, message)
