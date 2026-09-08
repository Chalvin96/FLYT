"""Strict lesson export v4 wire-contract tests."""

import pytest

from flyt.content.exceptions import LessonPacketError
from flyt.content.validation import parse_lesson_packet_or_raise
from flyt.content.validation import validate_packet_graph_or_raise
from tests.helpers.lesson_packets import packet_minimal
from tests.helpers.lesson_packets import packet_with_exercise


def test_parse_lesson_packet_given_minimal_v4_packet_expect_round_trip() -> None:
    packet = parse_lesson_packet_or_raise(packet_minimal())
    assert packet.schema_version == "4.0"
    assert packet.language == "nb-NO"
    assert packet.media.audio == []


def test_parse_lesson_packet_given_unknown_field_expect_rejection() -> None:
    data = packet_minimal()
    data["derived_from"] = "internal-note"
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


def test_parse_lesson_packet_given_v3_elements_expect_rejection() -> None:
    data = packet_minimal()
    data["elements"] = []
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


def test_parse_lesson_packet_given_singular_example_expect_acceptance() -> None:
    data = packet_minimal()
    data["sections"][0]["blocks"].append(
        {
            "kind": "example",
            "id": "example-1",
            "no": [{"kind": "text", "value": "Jeg leser."}],
            "en": [{"kind": "text", "value": "I read."}],
        }
    )

    packet = parse_lesson_packet_or_raise(data)

    assert packet.sections[0].blocks[-1].kind == "example"


def test_parse_lesson_packet_given_grouped_examples_expect_acceptance() -> None:
    data = packet_minimal()
    data["sections"][0]["blocks"].append(
        {
            "kind": "examples",
            "id": "examples-1",
            "items": [
                {
                    "id": "example-item-1",
                    "no": [{"kind": "text", "value": "Jeg leser."}],
                    "en": [{"kind": "text", "value": "I read."}],
                }
            ],
        }
    )

    packet = parse_lesson_packet_or_raise(data)

    assert packet.sections[0].blocks[-1].kind == "examples"


def test_parse_lesson_packet_given_removed_content_block_expect_rejection() -> None:
    data = packet_minimal()
    data["sections"][0]["blocks"].append(
        {"kind": "word_list", "id": "removed-block", "items": []}
    )

    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


def test_parse_lesson_packet_given_removed_order_operation_expect_rejection() -> None:
    data = packet_with_exercise(
        {
            "kind": "exercise",
            "id": "ex-order",
            "operation": "order",
            "objective_id": "obj-1",
            "prompt": [{"kind": "text", "value": "Sorter."}],
            "explanation": None,
            "payload": {
                "items": [{"item_id": "a", "text": "a"}],
                "answer_order": ["a"],
            },
        }
    )
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


def test_parse_lesson_packet_given_wrong_schema_version_expect_rejection() -> None:
    data = packet_minimal()
    data["schema_version"] = "3.0"
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


@pytest.mark.parametrize(
    "operation",
    [
        "choose",
        "recall_fill",
        "match_pairs",
        "build",
        "judge",
        "find_fix",
        "categorize",
        "speak",
        "write",
    ],
)
def test_parse_lesson_packet_given_each_operation_payload_expect_acceptance(
    operation: str,
) -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for(operation)
    packet = parse_lesson_packet_or_raise(packet_with_exercise(exercise))
    assert [e.operation for e in packet.exercises] == [operation]
    validate_packet_graph_or_raise(packet)


def test_parse_lesson_packet_given_nullable_write_bounds_expect_acceptance() -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("write")
    exercise["payload"]["min_words"] = None
    exercise["payload"]["max_words"] = None
    packet = parse_lesson_packet_or_raise(packet_with_exercise(exercise))
    assert packet.exercises[0].payload.min_words is None
    assert packet.exercises[0].payload.max_words is None


def test_parse_lesson_packet_given_many_to_one_match_pairs_expect_acceptance() -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("match_pairs")
    exercise["payload"]["left"].append({"left_id": "l2", "text": "i dag"})
    exercise["payload"]["pairs"].append({"left_id": "l2", "right_id": "r1"})

    packet = parse_lesson_packet_or_raise(packet_with_exercise(exercise))

    validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_exercise_audio_reference_expect_acceptance() -> (
    None
):
    from tests.helpers.lesson_packets import exercise_for

    data = packet_with_exercise(exercise_for("speak"))
    data["exercises"][0]["audio_id"] = "audio-speak"
    data["media"]["audio"] = [
        {
            "id": "audio-speak",
            "path": "audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav",
            "url": "https://media.example.test/audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav",
            "mime": "audio/wav",
            "status": "synthesized",
        }
    ]

    packet = parse_lesson_packet_or_raise(data)

    validate_packet_graph_or_raise(packet)


def test_parse_lesson_packet_given_audio_statuses_expect_only_v4_values() -> None:
    data = packet_minimal()
    data["media"] = {
        "audio": [
            {
                "id": "a1",
                "path": "audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav",
                "url": "https://media.example.test/audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav",
                "mime": "audio/wav",
                "status": "placeholder",
            }
        ]
    }
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


@pytest.mark.parametrize(
    ("operation", "mutate"),
    [
        ("choose", lambda p: p["options"].append(dict(p["options"][0]))),
        (
            "recall_fill",
            lambda p: p["segments"].append(dict(p["segments"][1])),
        ),
        (
            "match_pairs",
            lambda p: p["left"].append(dict(p["left"][0])),
        ),
        (
            "match_pairs",
            lambda p: p["pairs"].append(dict(p["pairs"][0])),
        ),
        ("build", lambda p: p["tokens"].append(dict(p["tokens"][1]))),
        ("find_fix", lambda p: p["tokens"].append(dict(p["tokens"][0]))),
        ("categorize", lambda p: p["buckets"].append(dict(p["buckets"][0]))),
        ("categorize", lambda p: p["items"].append(dict(p["items"][0]))),
        ("write", lambda p: p["criteria"].append(dict(p["criteria"][0]))),
    ],
)
def test_parse_lesson_packet_given_duplicate_nested_ids_expect_rejection(
    operation: str, mutate
) -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for(operation)
    mutate(exercise["payload"])
    with pytest.raises(LessonPacketError, match="duplicate"):
        parse_lesson_packet_or_raise(packet_with_exercise(exercise))


def test_parse_lesson_packet_given_dangling_nested_reference_expect_rejection():
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("categorize")
    exercise["payload"]["items"][0]["bucket_id"] = "ghost"
    with pytest.raises(LessonPacketError, match="unknown bucket"):
        parse_lesson_packet_or_raise(packet_with_exercise(exercise))


def test_validate_packet_graph_given_request_note_expect_rejection() -> None:
    data = packet_minimal()
    data["sections"][0]["blocks"][0]["spans"] = [
        {"kind": "text", "value": "Practice-request: drill this in review."}
    ]
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="authoring request note"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_labelled_learner_paragraph_expect_acceptance():
    data = packet_minimal()
    data["sections"][0]["blocks"][0]["spans"] = [
        {"kind": "text", "value": "Context: a morning routine in Oslo."}
    ]
    packet = parse_lesson_packet_or_raise(data)
    validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_partial_dialogue_metadata_expect_rejection():
    data = packet_minimal()
    data["sections"][0]["blocks"].append(
        {
            "kind": "reading",
            "id": "half-dialogue",
            "spans": [{"kind": "text", "value": "Hei."}],
            "translation": "Hi.",
            "dialogue_id": "d1",
            "speaker_id": "anna",
            "speaker_name": None,
            "turn_index": 1,
        }
    )
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="partial dialogue metadata"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_duplicate_exercise_id_expect_rejection() -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("choose")
    packet = parse_lesson_packet_or_raise(
        packet_with_exercise(exercise, extra_exercise=dict(exercise, id=exercise["id"]))
    )
    with pytest.raises(LessonPacketError, match="duplicate exercise id"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_unknown_objective_expect_rejection() -> None:
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("speak")
    exercise["objective_id"] = "obj-missing"
    packet = parse_lesson_packet_or_raise(packet_with_exercise(exercise))
    with pytest.raises(LessonPacketError, match="unknown objective"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_unknown_practice_group_exercise_expect_rejection():
    data = packet_minimal()
    data["practice_groups"] = [
        {"id": "practice-obj-1", "objective_id": "obj-1", "exercise_ids": ["ghost"]}
    ]
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="unknown exercise"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_unassigned_exercise_expect_rejection() -> None:
    from tests.helpers.lesson_packets import exercise_for

    data = packet_with_exercise(exercise_for("choose"))
    data["practice_groups"] = []
    packet = parse_lesson_packet_or_raise(data)

    with pytest.raises(LessonPacketError, match="does not belong to a practice group"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_broken_dialogue_order_expect_rejection() -> None:
    data = packet_minimal()
    data["sections"] = [
        {
            "kind": "section",
            "id": "sec-1",
            "role": "model",
            "title": "Dialogue",
            "objective_ids": ["obj-1"],
            "blocks": [
                {
                    "kind": "reading",
                    "id": "sec-1-block-1",
                    "spans": [{"kind": "text", "value": "Hei."}],
                    "translation": "Hi.",
                    "dialogue_id": "d1",
                    "speaker_id": "anna",
                    "speaker_name": "Anna",
                    "turn_index": 2,
                }
            ],
        }
    ]
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="turn ordering"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_valid_packet_expect_no_error() -> None:
    from tests.helpers.lesson_packets import exercise_for

    packet = parse_lesson_packet_or_raise(packet_with_exercise(exercise_for("judge")))
    validate_packet_graph_or_raise(packet)


def test_parse_lesson_packet_given_missing_content_expect_rejection() -> None:
    data = packet_minimal()
    del data["content"]
    with pytest.raises(LessonPacketError, match="content"):
        parse_lesson_packet_or_raise(data)


def test_parse_lesson_packet_given_unknown_content_kind_expect_rejection() -> None:
    data = packet_minimal()
    data["content"] = [{"kind": "chapter", "id": "sec-1"}]
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise(data)


def test_validate_packet_graph_given_interleaved_content_expect_authored_order() -> (
    None
):
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("write")
    data = packet_with_exercise(exercise)
    data["sections"].append(
        {
            "kind": "section",
            "id": "sec-2",
            "role": "model",
            "title": "Apply",
            "objective_ids": ["obj-1"],
            "blocks": [],
        }
    )
    data["content"] = [
        {"kind": "section", "id": "sec-1"},
        {"kind": "exercise", "id": exercise["id"]},
        {"kind": "section", "id": "sec-2"},
    ]

    packet = parse_lesson_packet_or_raise(data)

    assert [(reference.kind, reference.id) for reference in packet.content] == [
        ("section", "sec-1"),
        ("exercise", exercise["id"]),
        ("section", "sec-2"),
    ]
    validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_unknown_content_reference_expect_rejection() -> (
    None
):
    data = packet_minimal()
    data["content"] = [{"kind": "section", "id": "ghost"}]
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="unknown section"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_cross_kind_content_reference_expect_rejection():
    from tests.helpers.lesson_packets import exercise_for

    exercise = exercise_for("choose")
    data = packet_with_exercise(exercise)
    data["content"].append({"kind": "section", "id": exercise["id"]})
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="unknown section"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_duplicate_content_reference_expect_rejection():
    data = packet_minimal()
    data["content"].append({"kind": "section", "id": "sec-1"})
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="duplicate content reference"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_uncovered_section_expect_rejection() -> None:
    from tests.helpers.lesson_packets import exercise_for

    data = packet_with_exercise(exercise_for("judge"))
    data["sections"].append(
        {
            "kind": "section",
            "id": "sec-2",
            "role": "model",
            "title": "Apply",
            "objective_ids": ["obj-1"],
            "blocks": [],
        }
    )
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="missing from content"):
        validate_packet_graph_or_raise(packet)


def test_validate_packet_graph_given_uncovered_exercise_expect_rejection() -> None:
    from tests.helpers.lesson_packets import exercise_for

    data = packet_with_exercise(exercise_for("speak"))
    data["content"] = [{"kind": "section", "id": "sec-1"}]
    packet = parse_lesson_packet_or_raise(data)
    with pytest.raises(LessonPacketError, match="missing from content"):
        validate_packet_graph_or_raise(packet)
