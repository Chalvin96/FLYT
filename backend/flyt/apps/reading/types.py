from dataclasses import dataclass
from datetime import datetime

from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage


@dataclass(frozen=True)
class ReadingGroupWithCount:
    group: ReadingGroup
    story_count: int


@dataclass(frozen=True)
class StoryListItem:
    story: Story
    is_read: bool
    read_at: datetime | None
    completed: bool = False


@dataclass(frozen=True)
class StoryListResult:
    group: ReadingGroup
    stories: list[StoryListItem]
    next_cursor: str | None
    total_count: int
    level_counts: dict[str, int]


@dataclass(frozen=True)
class StoryPageResult:
    story: Story
    title: str
    page: StoryPage
    total_pages: int
    last_page_index: int
    completed: bool
    user_states: dict[str, UserLemmaState]
    # Resolved tokens for the page. Imports and curated stories both keep these
    # inline on StoryPage.text_annotations_json. The caller renders them.
    tokens: list[dict]


@dataclass(frozen=True)
class ReadingHomeSection:
    group: ReadingGroup
    story_count: int
    stories: list[StoryListItem]


@dataclass(frozen=True)
class ReadingHome:
    hero: Story | None
    sections: list[ReadingHomeSection]
