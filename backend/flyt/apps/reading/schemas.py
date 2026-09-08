from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.reading.constants import TITLE_MAX_LENGTH
from flyt.apps.reading.models import ImportStatus


class ReadingGroupRead(BaseModel):
    id: int
    key: str
    title: str
    order: int
    storyCount: int


class ReadingGroupsResponse(BaseModel):
    groups: list[ReadingGroupRead]


class StorySummaryRead(BaseModel):
    uuid: UUID
    title: str
    # None for imported stories, which carry no CEFR level or reading group.
    cefrLevel: str | None
    createdAt: datetime
    preview: str
    wordCount: int
    isRead: bool
    completed: bool


class StoryListResponse(BaseModel):
    group: ReadingGroupRead
    stories: list[StorySummaryRead]
    nextCursor: str | None
    totalCount: int
    levelCounts: dict[str, int]


class StoryRecommendationsResponse(BaseModel):
    stories: list[StorySummaryRead]


class HeroStoryRead(BaseModel):
    uuid: UUID
    title: str
    groupTitle: str | None
    cefrLevel: str | None
    preview: str


class ReadingHeroResponse(BaseModel):
    todaysStory: HeroStoryRead | None


class ReadingSectionRead(BaseModel):
    group: ReadingGroupRead
    stories: list[StorySummaryRead]


class ReadingHomeResponse(BaseModel):
    todaysStory: HeroStoryRead | None
    sections: list[ReadingSectionRead]


class StoryTokenRead(BaseModel):
    word: str
    start: int
    end: int
    lemmaUuid: UUID | None


class StoryPageRead(BaseModel):
    index: int
    content: str
    tokens: list[StoryTokenRead]


class StoryPageResponse(BaseModel):
    uuid: UUID
    title: str
    cefrLevel: str | None
    groupKey: str | None
    groupTitle: str | None
    page: StoryPageRead
    totalPages: int
    lastPageIndex: int
    completed: bool
    userStates: dict[str, UserLemmaState]


class StoryProgressUpdate(BaseModel):
    pageIndex: int = Field(ge=0)


class PasteImportCreate(BaseModel):
    """Web paste box: text plus an optional per-user title."""

    title: str | None = Field(default=None, max_length=TITLE_MAX_LENGTH)
    text: str


class ExtensionImportCreate(BaseModel):
    """Browser extension: extracted page text with title and source URL."""

    title: str | None = Field(default=None, max_length=TITLE_MAX_LENGTH)
    source_url: str
    text: str


class ImportItemRead(BaseModel):
    """One import as the list/fetch endpoints return it."""

    id: UUID
    storyUuid: UUID
    title: str
    sourceUrl: str | None
    status: ImportStatus
    errorCode: str | None
    errorMessage: str | None
    pageCount: int | None
    wordCount: int
    createdAt: datetime


class QuotaRead(BaseModel):
    """Lifetime import usage, so the client can render an ``n/limit`` indicator."""

    used: int
    limit: int


class ImportListResponse(BaseModel):
    """Cursor-paginated list of the caller's imports plus their quota usage."""

    items: list[ImportItemRead]
    nextCursor: str | None
    quota: QuotaRead


class RetryImportResponse(BaseModel):
    status: str
