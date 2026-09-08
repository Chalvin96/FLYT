"""Learner lesson progress, content reads, and exercise evaluation."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from flyt.apps.flashcards.card_service import EnrollmentShape
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.models import CardPool
from flyt.apps.lessons.consts import LessonState
from flyt.apps.lessons.exceptions import ExerciseEvaluationUnavailableError
from flyt.apps.lessons.exceptions import ExerciseNotFoundError
from flyt.apps.lessons.exceptions import ExerciseResponseInvalidError
from flyt.apps.lessons.exceptions import LessonNotCompleteError
from flyt.apps.lessons.exceptions import LessonNotFoundError
from flyt.apps.lessons.exceptions import LessonNotStartedError
from flyt.apps.lessons.exceptions import LessonUpdateError
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lessons.schemas import ExerciseCriterionVerdictRead
from flyt.apps.lessons.schemas import ExerciseEvaluationRead
from flyt.apps.lessons.schemas import LessonDetailRead
from flyt.apps.lessons.schemas import LessonSummaryRead
from flyt.apps.lessons.schemas import serialize_lesson_detail
from flyt.apps.lessons.schemas import serialize_lesson_summary
from flyt.apps.users.services import UserLemmaService
from flyt.clients.provider import ModelProvider
from flyt.content.schemas import AudioAsset
from flyt.content.schemas import WriteExercise
from flyt.content.schemas import WritePayload
from flyt.evaluation.service import EvaluationCase
from flyt.evaluation.service import EvaluationCriterion
from flyt.evaluation.service import EvaluationService
from flyt.evaluation.service import EvaluationUnavailableError
from flyt.libs.utils.date import now

logger = logging.getLogger(__name__)


def audio_url(asset: AudioAsset) -> str:
    return asset.url


def validate_write_response_or_raise(payload: WritePayload, response: str) -> None:
    if payload.response_language != "no":
        raise ExerciseResponseInvalidError(
            "This exercise cannot be judged in its authored language."
        )
    trimmed = response.strip()
    if not trimmed:
        raise ExerciseResponseInvalidError("Write a response before checking.")
    word_count = len(trimmed.split())
    if payload.min_words is not None and word_count < payload.min_words:
        raise ExerciseResponseInvalidError(
            f"Write at least {payload.min_words} words before checking."
        )
    if payload.max_words is not None and word_count > payload.max_words:
        raise ExerciseResponseInvalidError(
            f"Write no more than {payload.max_words} words before checking."
        )


def _evaluation_case(exercise: WriteExercise, response: str) -> EvaluationCase:
    return EvaluationCase(
        instructions=exercise.payload.judge_prompt,
        task="".join(span.value for span in exercise.prompt).strip(),
        response=response,
        criteria=tuple(
            EvaluationCriterion(id=criterion.id, instruction=criterion.instruction)
            for criterion in exercise.payload.criteria
        ),
    )


class LessonService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        evaluation_service: EvaluationService | None = None,
    ):
        self.db = db
        self.evaluation_service = evaluation_service

    # --- Read paths ---

    async def list_lessons(self, user_id: int) -> list[LessonSummaryRead]:
        lessons = await self._active_lesson_revision_lessons()
        progress_by_lesson_id = {
            progress.lesson_id: progress
            for progress in (
                await self.db.scalars(
                    select(UserLessonProgress).where(
                        UserLessonProgress.user_id == user_id
                    )
                )
            ).all()
        }
        return [
            serialize_lesson_summary(
                lesson,
                self._lesson_state(progress_by_lesson_id.get(lesson.id)),
                progress_by_lesson_id.get(lesson.id),
            )
            for lesson in lessons
        ]

    async def find_lesson_or_raise(self, lesson_id: int) -> Lesson:
        lesson = await self.db.scalar(select(Lesson).where(Lesson.id == lesson_id))
        if lesson is None:
            raise LessonNotFoundError()
        return lesson

    async def get_lesson_detail(self, user_id: int, lesson_id: int) -> LessonDetailRead:
        lesson = await self.find_lesson_or_raise(lesson_id)
        progress = await self.find_progress(user_id, lesson_id)
        packet = lesson.packet_json
        media = packet.get("media", {}) if isinstance(packet, dict) else {}
        audio_urls: dict[str, str] = {
            asset["id"]: audio_url(AudioAsset.model_validate(asset))
            for asset in media.get("audio", [])
        }
        return serialize_lesson_detail(lesson, audio_urls, progress)

    async def find_progress(
        self, user_id: int, lesson_id: int
    ) -> UserLessonProgress | None:
        return await self.db.scalar(
            select(UserLessonProgress)
            .where(UserLessonProgress.user_id == user_id)
            .where(UserLessonProgress.lesson_id == lesson_id)
        )

    # --- Learner runtime ---

    async def start_lesson(self, user_id: int, lesson_id: int) -> UserLessonProgress:
        await self.find_lesson_or_raise(lesson_id)
        existing = await self.find_progress(user_id, lesson_id)
        if existing is None:
            result = await self.db.scalar(
                pg_insert(UserLessonProgress)
                .values(
                    user_id=user_id,
                    lesson_id=lesson_id,
                    completed_exercise_ids_json=[],
                )
                .on_conflict_do_nothing(
                    constraint="uq_user_lesson_progress_user_lesson"
                )
                .returning(UserLessonProgress)
            )
            progress = result or await self.find_progress(user_id, lesson_id)
        elif existing.completed_at is not None:
            existing.completed_exercise_ids_json = []
            existing.completed_at = None
            progress = existing
        else:
            progress = existing

        await self.enroll_lesson_pools(user_id, lesson_id)
        if progress is None:
            raise LessonUpdateError("Failed to create lesson progress")
        return progress

    async def enroll_lesson_pools(self, user_id: int, lesson_id: int) -> None:
        pool_ids = list(
            (
                await self.db.scalars(
                    select(CardPool.id).where(CardPool.lesson_id == lesson_id)
                )
            ).all()
        )
        await FlashcardCardService(self.db, UserLemmaService(self.db)).enroll_pools(
            user_id,
            pool_ids,
            shape=EnrollmentShape.ACTIVATE_NOW,
            require_addable_variant=True,
        )

    async def complete_exercise(
        self, user_id: int, lesson_id: int, exercise_id: str
    ) -> UserLessonProgress:
        lesson = await self.find_lesson_or_raise(lesson_id)
        authored_ids = {
            exercise["id"] for exercise in lesson.packet_json.get("exercises", [])
        }
        if exercise_id not in authored_ids:
            raise ExerciseNotFoundError()

        progress = await self.db.scalar(
            select(UserLessonProgress)
            .where(UserLessonProgress.user_id == user_id)
            .where(UserLessonProgress.lesson_id == lesson_id)
            .with_for_update()
        )
        if progress is None:
            raise LessonNotStartedError()

        completed = list(progress.completed_exercise_ids_json or [])
        if exercise_id not in completed:
            completed.append(exercise_id)
            progress.completed_exercise_ids_json = completed
        return progress

    async def complete_lesson(self, user_id: int, lesson_id: int) -> None:
        lesson = await self.find_lesson_or_raise(lesson_id)
        authored_ids = {
            exercise["id"] for exercise in lesson.packet_json.get("exercises", [])
        }
        progress = await self.find_progress(user_id, lesson_id)
        if progress is None:
            raise LessonNotStartedError()
        if progress.completed_at is None:
            completed_ids = set(progress.completed_exercise_ids_json or [])
            if not authored_ids.issubset(completed_ids):
                raise LessonNotCompleteError()
            progress.completed_at = now()

    def find_write_exercise_or_raise(
        self, lesson: Lesson, exercise_id: str
    ) -> WriteExercise:
        for raw in lesson.packet_json.get("exercises", []):
            if raw.get("id") == exercise_id:
                if raw.get("operation") != "write":
                    raise ExerciseNotFoundError("Exercise is not a write exercise")
                return WriteExercise.model_validate(raw)
        raise ExerciseNotFoundError()

    async def evaluate_write_exercise(
        self,
        user_id: int,
        lesson_id: int,
        exercise_id: str,
        response: str,
        *,
        provider: ModelProvider | None = None,
    ) -> ExerciseEvaluationRead:
        """Evaluate one write submission without persisting anything.

        The private ``judge_prompt`` and criteria are read from the stored
        packet; only validated criterion verdicts are returned.
        """
        lesson = await self.find_lesson_or_raise(lesson_id)
        exercise = self.find_write_exercise_or_raise(lesson, exercise_id)
        validate_write_response_or_raise(exercise.payload, response)

        evaluator = (
            EvaluationService(provider)
            if provider is not None
            else self.evaluation_service
        )
        if evaluator is None:
            raise RuntimeError("Lesson evaluation service is not configured")
        try:
            verdicts = await evaluator.evaluate(
                user_id,
                _evaluation_case(exercise, response),
            )
        except EvaluationUnavailableError as failure:
            logger.warning(
                "exercise evaluator failed for lesson %s exercise %s: %s",
                lesson_id,
                exercise_id,
                failure,
            )
            raise ExerciseEvaluationUnavailableError() from failure
        return ExerciseEvaluationRead(
            criteria=[
                ExerciseCriterionVerdictRead(
                    criterion_id=verdict.criterion_id,
                    met=verdict.met,
                    evidence=verdict.evidence,
                )
                for verdict in verdicts
            ]
        )

    async def _active_lesson_revision_lessons(self) -> list[Lesson]:
        active_revision = await self.db.scalar(
            select(LessonRelease)
            .where(LessonRelease.is_active.is_(True))
            .options(selectinload(LessonRelease.lessons))
            .order_by(LessonRelease.id.desc())
        )
        if active_revision is None:
            return []
        return sorted(
            active_revision.lessons,
            key=lambda lesson: lesson.release_order,
        )

    def _lesson_state(self, progress: UserLessonProgress | None) -> LessonState:
        if progress is None:
            return LessonState.NOT_STARTED
        if progress.completed_at is not None:
            return LessonState.COMPLETED
        return LessonState.IN_PROGRESS
