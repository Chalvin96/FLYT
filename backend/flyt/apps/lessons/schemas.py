from copy import deepcopy
from datetime import datetime
from typing import Any

from pydantic import BaseModel
from pydantic import Field

from flyt.apps.lessons.consts import LessonState
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lessons.utils import estimate_lesson_minutes
from flyt.content.schemas import AudioStatus

K_EXERCISE_RESPONSE_MAX_CHARS = 500


class LessonSummaryRead(BaseModel):
    id: int
    source_id: str
    kind: str
    family_id: str | None
    title: str
    cefr_level: str | None
    goal: str | None
    order: int
    state: LessonState
    estimated_minutes: int
    last_activity_at: datetime | None


class LessonProgressRead(BaseModel):
    completed_exercise_ids: list[str]
    completed_at: datetime | None


class LessonAudioRead(BaseModel):
    id: str
    url: str
    path: str
    mime: str
    status: AudioStatus
    duration_ms: int | None = None
    sha256: str | None = None


class LessonMediaRead(BaseModel):
    audio: list[LessonAudioRead]


class LessonDetailRead(BaseModel):
    id: int
    source_id: str
    kind: str
    family_id: str | None
    title: str
    cefr_level: str | None
    goal: str | None
    order: int
    estimated_minutes: int
    packet: dict[str, Any]
    media: LessonMediaRead
    progress: LessonProgressRead | None


class ExerciseResponseRequest(BaseModel):
    response: str = Field(max_length=K_EXERCISE_RESPONSE_MAX_CHARS)


class ExerciseCriterionVerdictRead(BaseModel):
    criterion_id: str
    met: bool
    evidence: str | None = None


class ExerciseEvaluationRead(BaseModel):
    criteria: list[ExerciseCriterionVerdictRead]


def serialize_lesson_progress(progress: UserLessonProgress) -> LessonProgressRead:
    return LessonProgressRead(
        completed_exercise_ids=list(progress.completed_exercise_ids_json or []),
        completed_at=progress.completed_at,
    )


def serialize_lesson_summary(
    lesson: Lesson,
    state: LessonState,
    progress: UserLessonProgress | None,
) -> LessonSummaryRead:
    packet = lesson.packet_json
    return LessonSummaryRead(
        id=lesson.id,
        source_id=lesson.source_id,
        kind=lesson.kind,
        family_id=lesson.family_id,
        title=lesson.title,
        cefr_level=lesson.cefr_level,
        goal=lesson.goal,
        order=lesson.release_order,
        state=state,
        estimated_minutes=estimate_lesson_minutes(packet),
        last_activity_at=progress.updated_at if progress is not None else None,
    )


def learner_safe_exercise_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Copy of one operation payload without private authoring instructions.

    ``write.payload.judge_prompt`` is model-facing material; the stored packet
    and flashcard snapshot keep it for server-side judging, but it must never
    cross a learner API.
    """
    sanitized = dict(payload)
    if sanitized.get("operation") == "write":
        inner = sanitized.get("payload")
        if isinstance(inner, dict):
            inner = dict(inner)
            inner.pop("judge_prompt", None)
            sanitized["payload"] = inner
    return sanitized


def learner_safe_packet(packet: dict[str, Any]) -> dict[str, Any]:
    """Copy of the stored packet with every exercise learner-safe."""
    sanitized = deepcopy(packet)
    exercises = sanitized.get("exercises")
    if isinstance(exercises, list):
        sanitized["exercises"] = [
            learner_safe_exercise_payload(exercise)
            if isinstance(exercise, dict)
            else exercise
            for exercise in exercises
        ]
    return sanitized


def serialize_lesson_detail(
    lesson: Lesson,
    audio_urls: dict[str, str],
    progress: UserLessonProgress | None,
) -> LessonDetailRead:
    packet = learner_safe_packet(lesson.packet_json)
    media = (
        lesson.packet_json.get("media", {})
        if isinstance(lesson.packet_json, dict)
        else {}
    )
    return LessonDetailRead(
        id=lesson.id,
        source_id=lesson.source_id,
        kind=lesson.kind,
        family_id=lesson.family_id,
        title=lesson.title,
        cefr_level=lesson.cefr_level,
        goal=lesson.goal,
        order=lesson.release_order,
        estimated_minutes=estimate_lesson_minutes(packet),
        packet=packet,
        media=LessonMediaRead(
            audio=[
                LessonAudioRead(
                    id=asset["id"],
                    url=audio_urls[asset["id"]],
                    path=asset["path"],
                    mime=asset["mime"],
                    status=asset["status"],
                    duration_ms=asset.get("duration_ms"),
                    sha256=asset.get("sha256"),
                )
                for asset in media.get("audio", [])
            ]
        ),
        progress=(
            serialize_lesson_progress(progress) if progress is not None else None
        ),
    )
