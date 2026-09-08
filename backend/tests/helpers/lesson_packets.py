"""Deterministic v4 packet builders for tests."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def packet_minimal() -> dict[str, Any]:
    return {
        "schema_version": "4.0",
        "id": "lesson-a",
        "kind": "grammar",
        "language": "nb-NO",
        "title": "Lesson A",
        "cefr_level": "A1",
        "goal": "Practice.",
        "objectives": [{"id": "obj-1", "statement": "Use the pattern."}],
        "content": [{"kind": "section", "id": "sec-1"}],
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
                        "spans": _spans("Jeg jobber i dag."),
                    }
                ],
            }
        ],
        "exercises": [],
        "practice_groups": [],
        "media": {"audio": []},
    }


def exercise_for(operation: str) -> dict[str, Any]:
    base = {
        "kind": "exercise",
        "id": f"ex-{operation}",
        "objective_id": "obj-1",
        "prompt": _spans("Do the thing."),
        "explanation": None,
    }
    payloads: dict[str, dict[str, Any]] = {
        "choose": {
            "options": [
                {"option_id": "a", "text": "Ja", "why": None},
                {"option_id": "b", "text": "Nei", "why": None},
            ],
            "answer_id": "a",
            "stem": _spans("Mina jobber i dag."),
        },
        "recall_fill": {
            "segments": [
                {"kind": "span", "spans": _spans("Jeg ")},
                {
                    "kind": "blank",
                    "blank_id": "b1",
                    "options": ["jobber", "jobbet"],
                    "answer_index": 0,
                },
            ]
        },
        "match_pairs": {
            "left": [{"left_id": "l1", "text": "dag"}],
            "right": [{"right_id": "r1", "text": "day"}],
            "pairs": [{"left_id": "l1", "right_id": "r1"}],
        },
        "build": {
            "tokens": [
                {"token_id": "jeg", "text": "Jeg", "fixed": True},
                {"token_id": "jobber", "text": "jobber", "fixed": False},
            ],
            "answer_order": ["jeg", "jobber"],
        },
        "judge": {
            "sentence": _spans("Jeg jobber i dag."),
            "is_correct": True,
            "feedback": None,
        },
        "find_fix": {
            "tokens": [
                {"token_id": "jeg", "text": "Jeg"},
                {"token_id": "jobbet", "text": "jobbet"},
            ],
            "error_token_id": "jobbet",
            "feedback": "jobber",
        },
        "categorize": {
            "buckets": [
                {"bucket_id": "presens", "label": "Presens"},
                {"bucket_id": "preteritum", "label": "Preteritum"},
            ],
            "items": [
                {"item_id": "a", "text": "jobber", "bucket_id": "presens"},
                {"item_id": "b", "text": "jobbet", "bucket_id": "preteritum"},
            ],
        },
        "speak": {"target": "Jeg jobber i dag."},
        "write": {
            "response_language": "no",
            "min_words": 5,
            "max_words": 40,
            "judge_prompt": "Judge the paragraph.",
            "criteria": [{"id": "c1", "instruction": "Bruker presens."}],
        },
    }
    return {**base, "operation": operation, "payload": deepcopy(payloads[operation])}


def packet_with_exercise(
    exercise: dict[str, Any],
    extra_exercise: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = packet_minimal()
    data["exercises"] = [exercise]
    if extra_exercise is not None:
        data["exercises"].append(extra_exercise)
    data["content"].extend(
        {"kind": "exercise", "id": exercise["id"]} for exercise in data["exercises"]
    )
    data["practice_groups"] = [
        {
            "id": "practice-obj-1",
            "objective_id": "obj-1",
            "exercise_ids": [e["id"] for e in data["exercises"]],
        }
    ]
    return data


def _spans(text: str) -> list[dict[str, Any]]:
    return [{"kind": "text", "value": text}]
