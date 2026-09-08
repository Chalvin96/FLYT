from dataclasses import dataclass
from enum import StrEnum


class ChatbotModel(StrEnum):
    FLYT = "flyt"
    CHATGPT = "chatgpt"
    DEEPSEEK = "deepseek"
    GLM = "glm"


@dataclass(frozen=True)
class ChatbotModelDefinition:
    id: ChatbotModel
    label: str
    detail: str
    requires_openrouter_key: bool
    funded_by_flyt: bool = False


@dataclass(frozen=True)
class OpenRouterKeyStatus:
    configured: bool
