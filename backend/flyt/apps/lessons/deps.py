from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lessons.content_service import LessonContentService
from flyt.apps.lessons.runtime_service import LessonService
from flyt.clients.openrouter import OpenRouterProvider
from flyt.core.db import get_async_db
from flyt.core.config import settings
from flyt.evaluation.service import EvaluationService


def build_lesson_evaluation_service() -> EvaluationService:
    return EvaluationService(
        OpenRouterProvider(
            model=settings.LESSON_WRITE_JUDGE_OPENROUTER_MODEL,
            reasoning_enabled=settings.LESSON_WRITE_JUDGE_OPENROUTER_REASONING_ENABLED,
            timeout_seconds=settings.LESSON_WRITE_JUDGE_OPENROUTER_TIMEOUT_SECONDS,
        )
    )


def build_lesson_service(db: AsyncSession) -> LessonService:
    return LessonService(db, evaluation_service=build_lesson_evaluation_service())


def build_lesson_content_service(db: AsyncSession) -> LessonContentService:
    return LessonContentService(db)


def get_lesson_service(
    db: AsyncSession = Depends(get_async_db),
) -> LessonService:
    return build_lesson_service(db)
