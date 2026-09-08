"""Build small v4 import directories for service-level tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from flyt.content.schemas import LessonPacket
from tests.helpers.lesson_packets import exercise_for

SCHEMA = LessonPacket.model_json_schema()


def packet_for(
    lesson_id: str, exercises: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    if exercises is None:
        exercises = [exercise_for("choose"), exercise_for("speak")]
    return {
        "schema_version": "4.0",
        "id": lesson_id,
        "kind": "grammar",
        "language": "nb-NO",
        "title": f"Lesson {lesson_id}",
        "cefr_level": "A1",
        "goal": "Practice.",
        "objectives": [{"id": "obj-1", "statement": "Use the pattern."}],
        "sections": [
            {
                "kind": "section",
                "id": "sec-1",
                "role": "orient",
                "title": "Intro",
                "objective_ids": ["obj-1"],
                "blocks": [
                    {
                        "kind": "paragraph",
                        "id": "sec-1-block-1",
                        "spans": [{"kind": "text", "value": "Jeg jobber."}],
                    }
                ],
            }
        ],
        "exercises": exercises,
        "content": [
            {"kind": "section", "id": "sec-1"},
            *({"kind": "exercise", "id": exercise["id"]} for exercise in exercises),
        ],
        "practice_groups": [
            {
                "id": "practice-obj-1",
                "objective_id": "obj-1",
                "exercise_ids": [exercise["id"] for exercise in exercises],
            }
        ],
        "media": {"audio": []},
    }


def build_import_dir(
    root: Path,
    *,
    lesson_ids: list[str],
    with_audio: bool = False,
    exercises: list[dict[str, Any]] | None = None,
) -> Path:
    (root / "dist" / "lessons").mkdir(parents=True)
    (root / "dist" / "schema").mkdir(parents=True)
    (root / "dist" / "schema" / "lesson.schema.json").write_text(json.dumps(SCHEMA))

    entries = []
    for position, lesson_id in enumerate(lesson_ids):
        packet = packet_for(lesson_id, exercises=exercises)
        if with_audio:
            packet["media"] = {
                "audio": [
                    {
                        "id": "audio-model",
                        "path": (
                            f"audio/lessons/{lesson_id}/"
                            "00000000-0000-4000-8000-000000000001.wav"
                        ),
                        "url": (
                            f"https://media.example.test/audio/lessons/{lesson_id}/"
                            "00000000-0000-4000-8000-000000000001.wav"
                        ),
                        "mime": "audio/wav",
                        "status": "synthesized",
                    }
                ]
            }
            packet["sections"][0]["blocks"].append(
                {
                    "kind": "reading",
                    "id": "sec-1-block-2",
                    "spans": [{"kind": "text", "value": "Hvor er bussen?"}],
                    "translation": "Where is the bus?",
                    "audio_id": "audio-model",
                }
            )
        (root / "dist" / "lessons" / f"{lesson_id}.json").write_text(json.dumps(packet))
        entries.append(
            {
                "lesson_id": lesson_id,
                "position": position,
                "family_id": None,
            }
        )

    (root / "dist" / "catalog.json").write_text(
        json.dumps(
            {
                "lessons": entries,
            },
            sort_keys=True,
        )
    )
    return root
