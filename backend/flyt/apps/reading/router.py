import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession


from flyt.apps.reading.exceptions import ReadingNotFoundError
from flyt.apps.reading.exceptions import ReadingNotReadyError
from flyt.apps.reading.schemas import HeroStoryRead
from flyt.apps.reading.schemas import ReadingGroupRead
from flyt.apps.reading.schemas import ReadingGroupsResponse
from flyt.apps.reading.schemas import ReadingHeroResponse
from flyt.apps.reading.schemas import ReadingHomeResponse
from flyt.apps.reading.schemas import ReadingSectionRead
from flyt.apps.reading.schemas import StoryListResponse
from flyt.apps.reading.schemas import StoryPageRead
from flyt.apps.reading.schemas import StoryPageResponse
from flyt.apps.reading.schemas import StoryProgressUpdate
from flyt.apps.reading.schemas import StoryRecommendationsResponse
from flyt.apps.reading.schemas import StorySummaryRead
from flyt.apps.reading.schemas import StoryTokenRead
from flyt.apps.reading.services import ReadingService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.apps.users.services import UserVocabularyQueries
from flyt.core.db import get_async_db
from flyt.core.http import EmptyResponse
from flyt.core.http import error_response

logger = logging.getLogger(__name__)


def get_reading_service(db: AsyncSession = Depends(get_async_db)) -> ReadingService:
    return ReadingService(db, user_vocabulary_queries=UserVocabularyQueries(db))


router = APIRouter(prefix="/reading", tags=["reading"])


@router.get("/groups")
async def get_groups(
    service: Annotated[ReadingService, Depends(get_reading_service)],
) -> ReadingGroupsResponse:
    groups = await service.list_groups()
    return ReadingGroupsResponse(
        groups=[
            ReadingGroupRead(
                id=group_with_count.group.id,
                key=group_with_count.group.key,
                title=group_with_count.group.title,
                order=group_with_count.group.order,
                storyCount=group_with_count.story_count,
            )
            for group_with_count in groups
        ]
    )


@router.get("/stories")
async def get_stories(
    group_key: Annotated[str, Query(min_length=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReadingService, Depends(get_reading_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query()] = None,
    levels: Annotated[str | None, Query()] = None,
    show_read: Annotated[bool, Query()] = True,
) -> StoryListResponse:
    parsed_levels = None
    if levels is not None:
        parsed_levels = [level.strip() for level in levels.split(",") if level.strip()]

    try:
        result = await service.list_stories(
            group_key=group_key,
            user_id=current_user.id,
            limit=limit,
            cursor=cursor,
            levels=parsed_levels,
            show_read=show_read,
        )
        return StoryListResponse(
            group=ReadingGroupRead(
                id=result.group.id,
                key=result.group.key,
                title=result.group.title,
                order=result.group.order,
                storyCount=result.total_count,
            ),
            stories=[
                StorySummaryRead(
                    uuid=item.story.uuid,
                    title=item.story.title,
                    cefrLevel=item.story.cefr_level,
                    createdAt=item.story.created_at,
                    preview=service.build_preview(item.story.content),
                    wordCount=item.story.word_count,
                    isRead=item.is_read,
                    completed=item.completed,
                )
                for item in result.stories
            ],
            nextCursor=result.next_cursor,
            totalCount=result.total_count,
            levelCounts=result.level_counts,
        )
    except ReadingNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response("INVALID_CURSOR", str(error)),
        ) from error


@router.get("/home")
async def get_home(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReadingService, Depends(get_reading_service)],
) -> ReadingHomeResponse:
    home = await service.get_home(current_user.id)
    return ReadingHomeResponse(
        todaysStory=(
            None
            if home.hero is None
            else HeroStoryRead(
                uuid=home.hero.uuid,
                title=home.hero.title,
                groupTitle=home.hero.reading_group.title,
                cefrLevel=home.hero.cefr_level,
                preview=service.build_preview(home.hero.content),
            )
        ),
        sections=[
            ReadingSectionRead(
                group=ReadingGroupRead(
                    id=section.group.id,
                    key=section.group.key,
                    title=section.group.title,
                    order=section.group.order,
                    storyCount=section.story_count,
                ),
                stories=[
                    StorySummaryRead(
                        uuid=item.story.uuid,
                        title=item.story.title,
                        cefrLevel=item.story.cefr_level,
                        createdAt=item.story.created_at,
                        preview=service.build_preview(item.story.content),
                        wordCount=item.story.word_count,
                        isRead=item.is_read,
                        completed=item.completed,
                    )
                    for item in section.stories
                ],
            )
            for section in home.sections
        ],
    )


@router.get("/hero")
async def get_hero(
    service: Annotated[ReadingService, Depends(get_reading_service)],
) -> ReadingHeroResponse:
    story = await service.get_hero()
    return ReadingHeroResponse(
        todaysStory=(
            None
            if story is None
            else HeroStoryRead(
                uuid=story.uuid,
                title=story.title,
                groupTitle=story.reading_group.title,
                cefrLevel=story.cefr_level,
                preview=service.build_preview(story.content),
            )
        )
    )


@router.get(
    "/stories/{story_uuid}/recommendations",
)
async def get_story_recommendations(
    story_uuid: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReadingService, Depends(get_reading_service)],
    limit: Annotated[int, Query(ge=1, le=10)] = 3,
) -> StoryRecommendationsResponse:
    try:
        stories = await service.get_story_recommendations(
            story_uuid=story_uuid,
            user_id=current_user.id,
            limit=limit,
        )
        return StoryRecommendationsResponse(
            stories=[
                StorySummaryRead(
                    uuid=story.story.uuid,
                    title=story.story.title,
                    cefrLevel=story.story.cefr_level,
                    createdAt=story.story.created_at,
                    preview=service.build_preview(story.story.content),
                    wordCount=story.story.word_count,
                    isRead=story.is_read,
                    completed=story.completed,
                )
                for story in stories
            ]
        )
    except ReadingNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ReadingNotReadyError:
        # Import still processing — no recommendations to offer yet.
        return StoryRecommendationsResponse(stories=[])


@router.get("/stories/{story_uuid}")
async def get_story(
    story_uuid: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReadingService, Depends(get_reading_service)],
    page: int | None = None,
) -> StoryPageResponse:
    try:
        result = await service.get_story_page(story_uuid, current_user.id, page)
    except ReadingNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ReadingNotReadyError as error:
        # The caller owns this import but it is still processing; signal keep-polling.
        raise HTTPException(
            status_code=error.status_code,
            detail=error_response(error.code, f"Import is {error.status_value}."),
        ) from error
    return StoryPageResponse(
        uuid=result.story.uuid,
        title=result.title,
        cefrLevel=result.story.cefr_level,
        groupKey=result.story.reading_group.key if result.story.reading_group else None,
        groupTitle=(
            result.story.reading_group.title if result.story.reading_group else None
        ),
        page=StoryPageRead(
            index=result.page.index,
            content=result.page.content,
            tokens=[StoryTokenRead(**t) for t in result.tokens],
        ),
        totalPages=result.total_pages,
        lastPageIndex=result.last_page_index,
        completed=result.completed,
        userStates=result.user_states,
    )


@router.post("/stories/{story_uuid}/progress")
async def save_progress(
    story_uuid: UUID,
    body: StoryProgressUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ReadingService, Depends(get_reading_service)],
) -> EmptyResponse:
    try:
        await service.save_progress(story_uuid, current_user.id, body.pageIndex)
        await db.commit()
        return EmptyResponse()
    except ReadingNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=error_response(error.code, error.message),
        ) from error
    except ReadingNotReadyError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=error_response(error.code, f"Import is {error.status_value}."),
        ) from error
