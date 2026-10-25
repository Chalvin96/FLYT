"""Review-pool eligibility rules for lesson practice exercises."""

from __future__ import annotations

from typing import Any

from pydantic import TypeAdapter

from flyt.content.eligibility import group_ids_without_addable_variant
from flyt.content.eligibility import has_review_exercises
from flyt.content.eligibility import is_exercise_addable
from flyt.content.schemas import ExercisePacket
from flyt.content.schemas import LessonPacket
from tests.helpers.lesson_packets import exercise_for
from tests.helpers.lesson_packets import packet_minimal

_EXERCISE_ADAPTER = TypeAdapter(ExercisePacket)


def test_is_exercise_addable_given_no_review_exercises_expect_regular_addable() -> None:
    exercise = _exercise("choose", exercise_id="ex-choose")

    result = is_exercise_addable(exercise, lesson_has_review_exercises=False)

    assert result is True


def test_is_exercise_addable_given_review_exercises_expect_regular_not_addable() -> (
    None
):
    exercise = _exercise("choose", exercise_id="ex-choose")

    result = is_exercise_addable(exercise, lesson_has_review_exercises=True)

    assert result is False


def test_is_exercise_addable_given_review_exercise_expect_addable() -> None:
    exercise = _exercise("build", exercise_id="review_build")

    result = is_exercise_addable(exercise, lesson_has_review_exercises=True)

    assert result is True


def test_has_review_exercises_given_review_id_in_practice_group_expect_true() -> None:
    packet = _packet_with_practice_ids(["review_choose", "ex-build"])

    assert has_review_exercises(packet) is True


def test_has_review_exercises_given_only_regular_ids_expect_false() -> None:
    packet = _packet_with_practice_ids(["ex-choose", "ex-build"])

    assert has_review_exercises(packet) is False


def test_has_review_exercises_given_review_id_outside_groups_expect_false() -> None:
    raw: dict[str, Any] = packet_minimal()
    raw["exercises"] = [exercise_for("choose")]
    raw["exercises"][0]["id"] = "review_choose"
    packet = LessonPacket.model_validate(raw)

    assert has_review_exercises(packet) is False


def test_group_ids_without_addable_variant_given_group_of_only_regular_exercises_expect_listed() -> (
    None
):
    packet = _two_group_packet(group_a_ids=["review_build"], group_b_ids=["ex-choose"])

    result = group_ids_without_addable_variant(packet)

    assert result == ["practice-obj-1-b"]


def test_group_ids_without_addable_variant_given_review_exercise_in_each_group_expect_empty() -> (
    None
):
    packet = _two_group_packet(
        group_a_ids=["review_build"], group_b_ids=["review_choose"]
    )

    result = group_ids_without_addable_variant(packet)

    assert result == []


def test_group_ids_without_addable_variant_given_lesson_without_review_exercises_expect_empty() -> (
    None
):
    packet = _packet_with_practice_ids(["ex-choose", "ex-build"])

    result = group_ids_without_addable_variant(packet)

    assert result == []


def _exercise(operation: str, *, exercise_id: str) -> ExercisePacket:
    raw: dict[str, Any] = exercise_for(operation)
    raw["id"] = exercise_id
    return _EXERCISE_ADAPTER.validate_python(raw)


def _packet_with_practice_ids(ids: list[str]) -> LessonPacket:
    raw: dict[str, Any] = packet_minimal()
    raw["exercises"] = [_raw_exercise_for_id(exercise_id) for exercise_id in ids]
    raw["content"] = [{"kind": "section", "id": "sec-1"}] + [
        {"kind": "exercise", "id": exercise_id} for exercise_id in ids
    ]
    raw["practice_groups"] = [
        {"id": "group-1", "objective_id": "obj-1", "exercise_ids": ids}
    ]
    return LessonPacket.model_validate(raw)


def _two_group_packet(
    *, group_a_ids: list[str], group_b_ids: list[str]
) -> LessonPacket:
    raw: dict[str, Any] = packet_minimal()
    all_ids = group_a_ids + group_b_ids
    raw["exercises"] = [_raw_exercise_for_id(exercise_id) for exercise_id in all_ids]
    raw["content"] = [{"kind": "section", "id": "sec-1"}] + [
        {"kind": "exercise", "id": exercise_id} for exercise_id in all_ids
    ]
    raw["practice_groups"] = [
        {
            "id": "practice-obj-1-a",
            "objective_id": "obj-1",
            "exercise_ids": group_a_ids,
        },
        {
            "id": "practice-obj-1-b",
            "objective_id": "obj-1",
            "exercise_ids": group_b_ids,
        },
    ]
    return LessonPacket.model_validate(raw)


def _raw_exercise_for_id(exercise_id: str) -> dict[str, Any]:
    operation = "build" if exercise_id.startswith("review_") else "choose"
    raw: dict[str, Any] = exercise_for(operation)
    raw["id"] = exercise_id
    return raw
