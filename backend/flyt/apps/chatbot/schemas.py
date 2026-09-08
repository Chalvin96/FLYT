from typing import Literal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import SecretStr
from pydantic import ValidationInfo
from pydantic import field_validator
from pydantic import model_serializer
from pydantic import model_validator

from flyt.apps.chatbot.constants import K_CHATBOT_CONTEXT_DETAIL_MAX_CHARACTERS
from flyt.apps.chatbot.constants import K_CHATBOT_CONTEXT_LABEL_MAX_CHARACTERS
from flyt.apps.chatbot.constants import K_CHATBOT_HISTORY_MAX_TURNS
from flyt.apps.chatbot.constants import K_CHATBOT_HISTORY_MESSAGE_MAX_CHARACTERS
from flyt.apps.chatbot.constants import K_CHATBOT_INPUT_MAX_CHARACTERS
from flyt.apps.chatbot.constants import K_CHATBOT_MESSAGE_MAX_CHARACTERS
from flyt.apps.chatbot.types import ChatbotModel


class ChatbotContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["general", "lesson", "reading", "selection"]
    label: str = Field(max_length=K_CHATBOT_CONTEXT_LABEL_MAX_CHARACTERS)
    detail: str | None = Field(
        default=None, max_length=K_CHATBOT_CONTEXT_DETAIL_MAX_CHARACTERS
    )

    @field_validator("label", "detail")
    @classmethod
    def strip_context_text(cls, value: str | None, info: ValidationInfo) -> str | None:
        if value is None:
            return None
        text = value.strip()
        if not text and info.field_name == "label":
            raise ValueError("Context label cannot be empty")
        return text


class ChatbotTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "chatbot"]
    content: str = Field(max_length=K_CHATBOT_HISTORY_MESSAGE_MAX_CHARACTERS)

    @field_validator("content")
    @classmethod
    def strip_turn_content(cls, value: str) -> str:
        content = value.strip()
        if not content:
            raise ValueError("Conversation content cannot be empty")
        return content


class ChatbotMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: ChatbotModel
    message: str = Field(
        min_length=1,
        max_length=K_CHATBOT_MESSAGE_MAX_CHARACTERS,
    )
    context: ChatbotContext | None = None
    history: list[ChatbotTurn] = Field(
        default_factory=list,
        max_length=K_CHATBOT_HISTORY_MAX_TURNS,
    )

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Message cannot be empty")
        return message

    @model_validator(mode="after")
    def validate_input_size(self) -> "ChatbotMessageCreate":
        input_characters = len(self.message) + sum(
            len(turn.content) for turn in self.history
        )
        if self.context is not None:
            input_characters += len(self.context.label)
            input_characters += len(self.context.detail or "")
        if input_characters > K_CHATBOT_INPUT_MAX_CHARACTERS:
            raise ValueError("Conversation input is too long")
        return self


class ChatbotModelRead(BaseModel):
    id: ChatbotModel
    label: str
    detail: str
    model: str
    available: bool
    reason: str | None = None
    action: str | None = None
    requiresOpenRouterKey: bool
    remainingPercent: int | None = None

    @model_serializer(mode="wrap")
    def _serialize_without_remaining_default(self, handler):
        data = handler(self)
        if data.get("remainingPercent") is None:
            data.pop("remainingPercent", None)
        return data


class ChatbotSurfaceRead(BaseModel):
    models: list[ChatbotModelRead]
    openrouterKeyConfigured: bool


class ChatbotMessageRead(BaseModel):
    model: ChatbotModel
    content: str


class OpenRouterKeyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apiKey: SecretStr

    @field_validator("apiKey")
    @classmethod
    def strip_api_key(cls, value: SecretStr) -> SecretStr:
        api_key = value.get_secret_value().strip()
        return SecretStr(api_key)


class OpenRouterKeyRead(BaseModel):
    openrouterKeyConfigured: bool
