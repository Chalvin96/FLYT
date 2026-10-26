"""Review-pool eligibility for lesson practice exercises.

Entry points: `is_exercise_addable` (called from `content_service`
practice-card upsert) and `group_ids_without_addable_variant` (called from
`validate_packet_graph_or_raise`); `has_review_exercises` is called from both and
tests. The durable policy is documented in `knowledge/domains/lessons.md`.
"""

from __future__ import annotations

from flyt.content.schemas import ExercisePacket
from flyt.content.schemas import LessonPacket

K_REVIEW_EXERCISE_ID_PREFIX = "review_"


def is_exercise_addable(
    exercise: ExercisePacket, *, lesson_has_review_exercises: bool
) -> bool:
    """Decide whether one practice exercise may seed long-term review cards."""
    if not exercise.id.startswith(K_REVIEW_EXERCISE_ID_PREFIX):
        return not lesson_has_review_exercises
    return True


def group_ids_without_addable_variant(packet: LessonPacket) -> list[str]:
    """Ids of practice groups that would end up with no addable exercise."""
    exercises_by_id = {exercise.id: exercise for exercise in packet.exercises}
    lesson_has = has_review_exercises(packet)
    return [
        group.id
        for group in packet.practice_groups
        if not any(
            is_exercise_addable(
                exercises_by_id[exercise_id],
                lesson_has_review_exercises=lesson_has,
            )
            for exercise_id in group.exercise_ids
        )
    ]


def has_review_exercises(packet: LessonPacket) -> bool:
    """Whether any exercise in the packet's practice groups is a review exercise."""
    return any(
        exercise_id.startswith(K_REVIEW_EXERCISE_ID_PREFIX)
        for group in packet.practice_groups
        for exercise_id in group.exercise_ids
    )
