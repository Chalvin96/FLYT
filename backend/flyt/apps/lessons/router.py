import logging
from typing import Annotated

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lessons.deps import get_lesson_service
from flyt.apps.lessons.exceptions import LessonError
from flyt.apps.lessons.schemas import ExerciseEvaluationRead
from flyt.apps.lessons.schemas import ExerciseResponseRequest
from flyt.apps.lessons.schemas import LessonDetailRead
from flyt.apps.lessons.schemas import LessonProgressRead
from flyt.apps.lessons.schemas import LessonSummaryRead
from flyt.apps.lessons.schemas import serialize_lesson_progress
from flyt.apps.lessons.runtime_service import LessonService
from flyt.apps.users.deps import get_current_user
from flyt.apps.users.models import User
from flyt.core.db import get_async_db
from flyt.core.http import EmptyResponse
from flyt.core.http import error_response

lessons_router = APIRouter(prefix="/lessons", tags=["lessons"])

logger = logging.getLogger(__name__)

ERROR_STATUS = {
    "LESSON_NOT_FOUND": status.HTTP_404_NOT_FOUND,
    "EXERCISE_NOT_FOUND": status.HTTP_404_NOT_FOUND,
    "LESSON_NOT_STARTED": status.HTTP_400_BAD_REQUEST,
    "LESSON_NOT_COMPLETE": status.HTTP_400_BAD_REQUEST,
    "WRITE_RESPONSE_INVALID": status.HTTP_422_UNPROCESSABLE_CONTENT,
    "WRITE_JUDGE_UNAVAILABLE": status.HTTP_503_SERVICE_UNAVAILABLE,
}


@lessons_router.get("")
async def list_lessons(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> list[LessonSummaryRead]:
    return await service.list_lessons(user_id=current_user.id)


@lessons_router.get("/{lesson_id}")
async def get_lesson(
    lesson_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonDetailRead:
    try:
        return await service.get_lesson_detail(current_user.id, lesson_id)
    except LessonError as error:
        raise HTTPException(
            status_code=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
            detail=error_response(error.code, error.message),
        ) from error


@lessons_router.post("/{lesson_id}/start")
async def start_lesson(
    lesson_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonProgressRead:
    try:
        progress = await service.start_lesson(current_user.id, lesson_id)
        await db.commit()
        return serialize_lesson_progress(progress)
    except LessonError as error:
        await db.rollback()
        raise HTTPException(
            status_code=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
            detail=error_response(error.code, error.message),
        ) from error


@lessons_router.post("/{lesson_id}/exercises/{exercise_id}/complete")
async def complete_exercise(
    lesson_id: int,
    exercise_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonProgressRead:
    try:
        progress = await service.complete_exercise(
            current_user.id, lesson_id, exercise_id
        )
        await db.commit()
        return serialize_lesson_progress(progress)
    except LessonError as error:
        await db.rollback()
        raise HTTPException(
            status_code=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
            detail=error_response(error.code, error.message),
        ) from error


async def admit_exercise_evaluation_request(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> None:
    retry_after = await request.app.state.exercise_evaluation_rate_limiter.check(
        str(current_user.uuid)
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_response(
                "WRITE_JUDGE_RATE_LIMITED",
                "Too many write checks. Try again later.",
            ),
            headers={"Retry-After": str(retry_after)},
        )


@lessons_router.post(
    "/{lesson_id}/exercises/{exercise_id}/judge-write",
    responses={
        429: {"description": "write-judge request window exhausted"},
    },
)
async def judge_write_exercise(
    lesson_id: int,
    exercise_id: str,
    body: ExerciseResponseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
    _admission: Annotated[None, Depends(admit_exercise_evaluation_request)],
) -> ExerciseEvaluationRead:
    try:
        return await service.evaluate_write_exercise(
            current_user.id, lesson_id, exercise_id, body.response
        )
    except LessonError as error:
        raise HTTPException(
            status_code=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
            detail=error_response(error.code, error.message),
        ) from error


@lessons_router.post("/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: int,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> EmptyResponse:
    try:
        await service.complete_lesson(current_user.id, lesson_id)
        await db.commit()
        return EmptyResponse()
    except LessonError as error:
        await db.rollback()
        raise HTTPException(
            status_code=ERROR_STATUS.get(error.code, status.HTTP_400_BAD_REQUEST),
            detail=error_response(error.code, error.message),
        ) from error
