from datetime import UTC
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_
from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy import true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.elements import ColumnElement

from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.reading.exceptions import ReadingNotFoundError
from flyt.apps.reading.exceptions import ReadingNotReadyError
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.types import ReadingGroupWithCount
from flyt.apps.reading.types import ReadingHome
from flyt.apps.reading.types import ReadingHomeSection
from flyt.apps.reading.types import StoryListItem
from flyt.apps.reading.types import StoryListResult
from flyt.apps.reading.types import StoryPageResult
from flyt.apps.reading.vocabulary import resolve_user_states_for_tokens
from flyt.apps.users.services import UserVocabularyQueries

K_DEFAULT_HERO_GROUP_KEY = "daily_life"
K_HOME_SECTION_STORY_LIMIT = 6


def public_story_filter() -> ColumnElement[bool]:
    return and_(
        Story.visibility == StoryVisibility.PUBLIC,
        Story.is_ready.is_(True),
    )


async def list_groups(db: AsyncSession) -> list[ReadingGroupWithCount]:
    rows = (
        await db.execute(
            select(
                ReadingGroup,
                func.count(Story.id).label("story_count"),
            )
            .outerjoin(
                Story,
                and_(Story.reading_group_id == ReadingGroup.id, public_story_filter()),
            )
            .group_by(ReadingGroup.id)
            .order_by(ReadingGroup.order.asc(), ReadingGroup.id.asc())
        )
    ).all()
    return [
        ReadingGroupWithCount(group=group, story_count=story_count)
        for group, story_count in rows
    ]


async def list_stories(
    db: AsyncSession,
    group_key: str,
    user_id: int,
    limit: int = 20,
    cursor: str | None = None,
    levels: list[str] | None = None,
    show_read: bool = True,
) -> StoryListResult:
    group = await _get_group_by_key(db, group_key)
    level_counts = await _get_story_counts_by_cefr_level(db, group.id)
    total_count = await _get_story_count_by_group(db, group.id)
    stories, next_cursor = await _list_story_page(
        db,
        group_id=group.id,
        user_id=user_id,
        limit=limit,
        cursor=cursor,
        levels=levels,
        show_read=show_read,
    )

    return StoryListResult(
        group=group,
        stories=stories,
        next_cursor=next_cursor,
        total_count=total_count,
        level_counts=level_counts,
    )


async def get_story_recommendations(
    db: AsyncSession,
    story_uuid: UUID,
    user_id: int,
    limit: int = 3,
) -> list[StoryListItem]:
    current_story = await readable_story_or_raise(db, story_uuid, user_id)

    read_at_column = UserStory.created_at.label("read_at")
    completed_column = UserStory.completed.label("completed")
    rows = (
        await db.execute(
            select(Story, read_at_column, completed_column)
            .outerjoin(
                UserStory,
                (UserStory.story_id == Story.id) & (UserStory.user_id == user_id),
            )
            .where(Story.id != current_story.id)
            .where(public_story_filter())
            .order_by(
                case((UserStory.id.is_not(None), 1), else_=0).asc(),
                case(
                    (Story.reading_group_id == current_story.reading_group_id, 0),
                    else_=1,
                ).asc(),
                case((Story.cefr_level == current_story.cefr_level, 0), else_=1).asc(),
                Story.created_at.desc(),
                Story.id.desc(),
            )
            .limit(limit)
        )
    ).all()

    return [
        StoryListItem(
            story=story,
            is_read=read_at is not None,
            read_at=read_at,
            completed=bool(completed),
        )
        for story, read_at, completed in rows
    ]


async def get_hero(db: AsyncSession) -> Story | None:
    return await db.scalar(
        select(Story)
        .join(ReadingGroup, ReadingGroup.id == Story.reading_group_id)
        .where(ReadingGroup.key == K_DEFAULT_HERO_GROUP_KEY)
        .where(public_story_filter())
        .options(joinedload(Story.reading_group))
        .order_by(Story.created_at.desc(), Story.id.desc())
        .limit(1)
    )


async def get_home(db: AsyncSession, user_id: int) -> ReadingHome:
    sections = await list_home_sections(db, user_id)
    hero = await get_hero(db)
    return ReadingHome(hero=hero, sections=sections)


async def list_home_sections(
    db: AsyncSession, user_id: int
) -> list[ReadingHomeSection]:
    groups = await list_groups(db)
    if not groups:
        return []

    group_ids = [with_count.group.id for with_count in groups]
    latest_stories = (
        select(
            Story.id,
            Story.uuid,
            Story.title,
            Story.cefr_level,
            Story.slug,
            Story.visibility,
            Story.is_ready,
            Story.word_count,
            Story.reading_group_id,
            Story.created_at,
            Story.updated_at,
        )
        .where(Story.reading_group_id == ReadingGroup.id)
        .where(public_story_filter())
        .order_by(Story.created_at.desc(), Story.id.desc())
        .limit(K_HOME_SECTION_STORY_LIMIT)
        .lateral("latest_stories")
    )
    latest_story = aliased(Story, latest_stories)
    read_at_column = UserStory.created_at.label("read_at")
    completed_column = UserStory.completed.label("completed")
    rows = (
        await db.execute(
            select(latest_story, read_at_column, completed_column)
            .select_from(ReadingGroup)
            .join(latest_stories, true())
            .outerjoin(
                UserStory,
                (UserStory.story_id == latest_story.id)
                & (UserStory.user_id == user_id),
            )
            .where(ReadingGroup.id.in_(group_ids))
            .order_by(latest_story.created_at.desc(), latest_story.id.desc())
        )
    ).all()

    stories_by_group: dict[int | None, list[StoryListItem]] = {}
    for story, read_at, completed in rows:
        stories_by_group.setdefault(story.reading_group_id, []).append(
            StoryListItem(
                story=story,
                is_read=read_at is not None,
                read_at=read_at,
                completed=bool(completed),
            )
        )
    return [
        ReadingHomeSection(
            group=with_count.group,
            story_count=with_count.story_count,
            stories=stories_by_group.get(with_count.group.id, []),
        )
        for with_count in groups
    ]


async def list_group_story_page(
    db: AsyncSession,
    group_id: int,
    user_id: int,
    limit: int,
    cursor: str | None = None,
    levels: list[str] | None = None,
    show_read: bool = True,
) -> tuple[list[StoryListItem], str | None]:
    return await _list_story_page(
        db,
        group_id=group_id,
        user_id=user_id,
        limit=limit,
        cursor=cursor,
        levels=levels,
        show_read=show_read,
    )


async def get_user_states_for_tokens(
    db: AsyncSession, tokens: list[dict], user_id: int
) -> dict[str, UserLemmaState]:
    return await resolve_user_states_for_tokens(
        tokens, user_id, UserVocabularyQueries(db)
    )


async def readable_story_or_raise(
    db: AsyncSession, story_uuid: UUID, user_id: int
) -> Story:
    story = await db.scalar(
        select(Story)
        .where(Story.uuid == story_uuid)
        .where(or_(Story.visibility == StoryVisibility.PRIVATE, public_story_filter()))
        .options(joinedload(Story.reading_group))
    )
    if story is None:
        raise ReadingNotFoundError("Story not found")

    if story.visibility is StoryVisibility.PUBLIC:
        return story

    owns = await db.scalar(
        select(UserStory).where(
            UserStory.user_id == user_id, UserStory.story_id == story.id
        )
    )
    if owns is None:
        raise ReadingNotFoundError("Story not found")
    meta = await db.scalar(select(ImportMeta).where(ImportMeta.story_id == story.id))
    if meta is None:
        raise ReadingNotFoundError("Story not found")
    if meta.status is not ImportStatus.READY:
        raise ReadingNotReadyError(meta.status.value)
    return story


async def get_story_page(
    db: AsyncSession, story_uuid: UUID, user_id: int, page_index: int | None = None
) -> StoryPageResult:
    story = await readable_story_or_raise(db, story_uuid, user_id)

    progress = await db.scalar(
        select(UserStory).where(
            UserStory.user_id == user_id, UserStory.story_id == story.id
        )
    )
    last_index = progress.last_page_index if progress else 0
    completed = progress.completed if progress else False
    total = await db.scalar(
        select(func.count(StoryPage.id)).where(StoryPage.story_id == story.id)
    )
    if not total:
        raise ReadingNotFoundError("Story has no pages")
    index = last_index if page_index is None else page_index
    index = max(0, min(index, total - 1))
    page = await db.scalar(
        select(StoryPage)
        .where(StoryPage.story_id == story.id)
        .order_by(StoryPage.index)
        .offset(index)
        .limit(1)
    )
    if page is None:
        raise ReadingNotFoundError("Story has no pages")
    tokens = _resolve_page_tokens(page)
    user_states = await get_user_states_for_tokens(db, tokens, user_id)
    title = (progress.title or story.title) if progress else story.title
    return StoryPageResult(
        story=story,
        title=title,
        page=page,
        total_pages=total,
        last_page_index=last_index,
        completed=completed,
        user_states=user_states,
        tokens=tokens,
    )


async def _get_group_by_key(db: AsyncSession, group_key: str) -> ReadingGroup:
    group = await db.scalar(select(ReadingGroup).where(ReadingGroup.key == group_key))
    if group is None:
        raise ReadingNotFoundError("Reading group not found")
    return group


async def _get_story_counts_by_cefr_level(
    db: AsyncSession, group_id: int
) -> dict[str, int]:
    level_rows = (
        await db.execute(
            select(
                Story.cefr_level,
                func.count(Story.id),
            )
            .where(Story.reading_group_id == group_id)
            .where(Story.cefr_level.is_not(None))
            .where(public_story_filter())
            .group_by(Story.cefr_level)
        )
    ).all()
    return {
        cefr_level: count for cefr_level, count in level_rows if cefr_level is not None
    }


async def _get_story_count_by_group(db: AsyncSession, group_id: int) -> int:
    return int(
        await db.scalar(
            select(func.count(Story.id))
            .where(Story.reading_group_id == group_id)
            .where(public_story_filter())
        )
        or 0
    )


async def _list_story_page(
    db: AsyncSession,
    group_id: int,
    user_id: int,
    limit: int,
    cursor: str | None = None,
    levels: list[str] | None = None,
    show_read: bool = True,
) -> tuple[list[StoryListItem], str | None]:
    cursor_timestamp: datetime | None = None
    cursor_story_id: int | None = None
    if cursor:
        cursor_timestamp, cursor_story_id = _parse_cursor(cursor)

    read_at_column = UserStory.created_at.label("read_at")
    completed_column = UserStory.completed.label("completed")
    query = (
        select(Story, read_at_column, completed_column)
        .outerjoin(
            UserStory,
            (UserStory.story_id == Story.id) & (UserStory.user_id == user_id),
        )
        .where(Story.reading_group_id == group_id)
        .where(public_story_filter())
    )

    if levels:
        query = query.where(Story.cefr_level.in_(levels))

    if not show_read:
        query = query.where(UserStory.id.is_(None))

    if cursor_timestamp is not None and cursor_story_id is not None:
        query = query.where(
            or_(
                Story.created_at < cursor_timestamp,
                and_(
                    Story.created_at == cursor_timestamp,
                    Story.id < cursor_story_id,
                ),
            )
        )

    query = query.order_by(Story.created_at.desc(), Story.id.desc()).limit(limit + 1)
    rows = (await db.execute(query)).all()

    has_more = len(rows) > limit
    stories = [
        StoryListItem(
            story=story,
            is_read=read_at is not None,
            read_at=read_at,
            completed=bool(completed),
        )
        for story, read_at, completed in rows[:limit]
    ]
    next_cursor = (
        _format_cursor(stories[-1].story.created_at, stories[-1].story.id)
        if has_more
        else None
    )
    return stories, next_cursor


def _parse_cursor(cursor: str) -> tuple[datetime, int]:
    timestamp_text, separator, story_id_text = cursor.partition("|")
    if not separator:
        raise ValueError("Invalid cursor")

    try:
        timestamp = datetime.fromisoformat(timestamp_text)
        story_id = int(story_id_text)
    except ValueError as error:
        raise ValueError("Invalid cursor") from error

    if timestamp.tzinfo is not None:
        timestamp = timestamp.astimezone(UTC).replace(tzinfo=None)

    return timestamp, story_id


def _format_cursor(timestamp: datetime, story_id: int) -> str:
    normalized_timestamp = timestamp
    if normalized_timestamp.tzinfo is not None:
        normalized_timestamp = normalized_timestamp.astimezone(UTC).replace(tzinfo=None)
    return f"{normalized_timestamp.isoformat()}|{story_id}"


def _resolve_page_tokens(page: StoryPage) -> list[dict]:
    return page.text_annotations_json or []
