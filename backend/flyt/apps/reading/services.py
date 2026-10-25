import math
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.constants import K_READING_WORDS_PER_MINUTE
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.queries import readable_story_or_raise


def calculate_reading_minutes(word_count: int) -> int:
    return math.ceil(word_count / K_READING_WORDS_PER_MINUTE)


class ReadingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def set_story_ready(self, story: Story, is_ready: bool) -> None:
        if is_ready:
            with self.db.no_autoflush:
                page_id = await self.db.scalar(
                    select(StoryPage.id).where(StoryPage.story_id == story.id).limit(1)
                )
            if page_id is None:
                raise ValueError("Story has no pages")
        story.is_ready = is_ready

    async def save_progress(
        self, story_uuid: UUID, user_id: int, page_index: int
    ) -> None:
        story = await readable_story_or_raise(self.db, story_uuid, user_id)
        total = await self.db.scalar(
            select(func.count(StoryPage.id)).where(StoryPage.story_id == story.id)
        )
        index = max(0, min(page_index, (total or 1) - 1))
        completed = index >= (total or 1) - 1
        stmt = (
            pg_insert(UserStory)
            .values(
                user_id=user_id,
                story_id=story.id,
                last_page_index=index,
                completed=completed,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "story_id"],
                set_={
                    "last_page_index": func.greatest(UserStory.last_page_index, index),
                    "completed": or_(UserStory.completed, literal(completed)),
                },
            )
        )
        await self.db.execute(stmt)
