import hashlib

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory


async def seed_active_imports(db: AsyncSession, user_id: int, count: int) -> None:
    stories = [
        Story(
            title=f"Import {index}",
            visibility=StoryVisibility.PRIVATE,
            is_ready=False,
            word_count=3,
        )
        for index in range(count)
    ]
    db.add_all(stories)
    await db.flush()
    statuses = list(ImportStatus)
    for index, story in enumerate(stories):
        digest = hashlib.sha256(f"quota fixture {user_id} {index}".encode()).hexdigest()
        db.add(
            ImportMeta(
                story_id=story.id,
                content_hash=digest,
                status=statuses[index % len(statuses)],
            )
        )
        db.add(UserStory(user_id=user_id, story_id=story.id))
    await db.flush()
