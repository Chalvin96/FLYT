from uuid import UUID

from pydantic import BaseModel
from pydantic import model_serializer

from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.story_generation.vocabulary import AnchorType


class ProviderChoiceRead(BaseModel):
    name: str
    model: str
    available: bool
    limitedByFlyt: bool
    reason: str | None = None
    action: str | None = None
    remainingPercent: int | None = None

    @model_serializer(mode="wrap")
    def _serialize_without_remaining_default(self, handler):
        data = handler(self)
        if data.get("remainingPercent") is None:
            data.pop("remainingPercent", None)
        return data


class AnchorChoiceRead(BaseModel):
    type: str
    available: bool
    reason: str | None = None


class GenerationPageTokenRead(BaseModel):
    word: str
    start: int
    end: int
    lemmaUuid: UUID | None


class GenerationPageRead(BaseModel):
    index: int
    content: str
    tokens: list[GenerationPageTokenRead]
    wordCount: int


class GenerationCurrentRead(BaseModel):
    generationId: int
    status: str
    provider: str
    anchor: str | None
    length: int
    topic: str | None
    pages: list[GenerationPageRead] | None = None
    userStates: dict[str, UserLemmaState] = {}
    failureCode: str | None = None
    failureMessage: str | None = None


class GenerationSurfaceRead(BaseModel):
    providers: list[ProviderChoiceRead]
    anchors: list[AnchorChoiceRead]
    deckCollapsesWithFrequency: bool
    minDeckSize: int
    lengthOptions: list[int]
    topicSuggestions: list[str]


class GenerationCreate(BaseModel):
    provider: str
    anchor: AnchorType | None = None
    length: int
    topic: str | None = None


class GenerationCreateResponse(BaseModel):
    generationId: int
    status: str


class GenerationImportCreate(BaseModel):
    title: str | None = None
