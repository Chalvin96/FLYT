from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path

import pytest

from flyt.content.exceptions import LessonImportError
from scripts.import_lessons import find_lesson_import_root_or_raise
from scripts.import_lessons import load_lesson_import_or_raise
from flyt.content.schemas import LessonPacket
from tests.helpers.lesson_packets import packet_minimal


def test_find_lesson_import_root_given_nested_catalog_expect_import_root(
    tmp_path: Path,
) -> None:
    root = _write_import(
        tmp_path / "archive" / "payload", {"lesson-a": _packet("lesson-a")}
    )

    assert find_lesson_import_root_or_raise(tmp_path) == root


def test_load_lesson_import_given_catalog_order_expect_position_order(
    tmp_path: Path,
) -> None:
    root = _write_import(
        tmp_path,
        {"aaa": _packet("aaa"), "zzz": _packet("zzz")},
        catalog={
            "lessons": [
                {"lesson_id": "zzz", "position": 1, "family_id": "later"},
                {"lesson_id": "aaa", "position": 0, "family_id": "first"},
            ]
        },
    )

    lesson_import = load_lesson_import_or_raise(root)

    assert [item.entry.lesson_id for item in lesson_import.lessons] == ["aaa", "zzz"]
    assert lesson_import.lessons[1].entry.family_id == "later"


def test_load_lesson_import_given_inventory_drift_expect_error(tmp_path: Path) -> None:
    root = _write_import(
        tmp_path,
        {"lesson-a": _packet("lesson-a")},
        catalog={
            "lessons": [
                {"lesson_id": "lesson-a", "position": 0},
                {"lesson_id": "lesson-b", "position": 1},
            ]
        },
    )

    with pytest.raises(LessonImportError, match="inventories differ"):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_nested_packet_directory_expect_error(
    tmp_path: Path,
) -> None:
    root = _write_import(tmp_path, {"lesson-a": _packet("lesson-a")})
    nested = root / "dist" / "lessons" / "nested"
    nested.mkdir()
    (nested / "rogue.json").write_text(json.dumps(_packet("rogue")), encoding="utf-8")

    with pytest.raises(LessonImportError, match="must be flat"):
        load_lesson_import_or_raise(root)


@pytest.mark.parametrize(
    ("catalog", "message"),
    [
        ({"lessons": [{"lesson_id": "lesson-a", "position": 1}]}, "contiguous"),
        (
            {
                "lessons": [
                    {"lesson_id": "lesson-a", "position": 0},
                    {"lesson_id": "lesson-a", "position": 1},
                ]
            },
            "Duplicate lesson id",
        ),
        (
            {"lessons": [{"lesson_id": "lesson-a", "position": 0, "title": "copy"}]},
            "Extra inputs",
        ),
    ],
)
def test_load_lesson_import_given_invalid_catalog_expect_error(
    tmp_path: Path, catalog: dict, message: str
) -> None:
    root = _write_import(tmp_path, {"lesson-a": _packet("lesson-a")}, catalog=catalog)

    with pytest.raises(LessonImportError, match=message):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_missing_catalog_expect_error(tmp_path: Path) -> None:
    root = _write_import(
        tmp_path, {"lesson-a": _packet("lesson-a")}, include_catalog=False
    )

    with pytest.raises(LessonImportError, match="Missing lesson catalog"):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_schema_version_is_required_expect_success(
    tmp_path: Path,
) -> None:
    schema = LessonPacket.model_json_schema()
    schema["required"] = [*schema["required"], "schema_version"]
    root = _write_import(
        tmp_path,
        {"lesson-a": _packet("lesson-a")},
        schema=schema,
    )

    lesson_import = load_lesson_import_or_raise(root)

    assert lesson_import.lesson_count == 1


def test_load_lesson_import_given_stale_audio_expect_error(tmp_path: Path) -> None:
    root = _write_import(tmp_path, {"lesson-a": _packet("lesson-a")})
    stale = root / "dist" / "audio" / "lessons" / "lesson-a" / "stale.wav"
    stale.parent.mkdir(parents=True)
    stale.write_bytes(b"stale")

    with pytest.raises(LessonImportError, match="Stale bundled audio"):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_symlinked_packet_expect_error(tmp_path: Path) -> None:
    root = _write_import(tmp_path / "import", {"lesson-a": _packet("lesson-a")})
    packet_path = root / "dist" / "lessons" / "lesson-a.json"
    outside_path = tmp_path / "outside.json"
    outside_path.write_text(packet_path.read_text(), encoding="utf-8")
    packet_path.unlink()
    packet_path.symlink_to(outside_path)

    with pytest.raises(LessonImportError, match="Symlink is not allowed"):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_symlinked_audio_expect_error(tmp_path: Path) -> None:
    packet = _packet("lesson-a")
    audio_path = "audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav"
    packet["media"]["audio"] = [
        {
            "id": "audio-1",
            "path": audio_path,
            "url": f"https://media.example.test/{audio_path}",
            "mime": "audio/wav",
            "status": "synthesized",
        }
    ]
    packet["sections"][0]["blocks"][0] = {
        "kind": "reading",
        "id": "sec-1-block-1",
        "spans": [{"kind": "text", "value": "Jeg jobber i dag."}],
        "translation": "I work today.",
        "audio_id": "audio-1",
    }
    root = _write_import(tmp_path / "import", {"lesson-a": packet})
    outside_path = tmp_path / "outside.wav"
    outside_path.write_bytes(b"outside")
    bundled_path = root / "dist" / audio_path
    bundled_path.parent.mkdir(parents=True)
    bundled_path.symlink_to(outside_path)

    with pytest.raises(LessonImportError, match="Symlink is not allowed"):
        load_lesson_import_or_raise(root)


def test_load_lesson_import_given_symlinked_digest_entry_expect_error(
    tmp_path: Path,
) -> None:
    root = _write_import(tmp_path / "import", {"lesson-a": _packet("lesson-a")})
    outside_path = tmp_path / "outside.txt"
    outside_path.write_text("outside", encoding="utf-8")
    (root / "dist" / "outside.txt").symlink_to(outside_path)

    with pytest.raises(LessonImportError, match="Symlink is not allowed"):
        load_lesson_import_or_raise(root)


def _packet(lesson_id: str) -> dict:
    packet = deepcopy(packet_minimal())
    packet["id"] = lesson_id
    packet["title"] = f"Packet {lesson_id}"
    return packet


def _write_import(
    root: Path,
    packets: dict[str, dict],
    *,
    catalog: dict | None = None,
    include_catalog: bool = True,
    schema: dict | None = None,
) -> Path:
    lessons_dir = root / "dist" / "lessons"
    schema_dir = root / "dist" / "schema"
    lessons_dir.mkdir(parents=True)
    schema_dir.mkdir(parents=True)
    (schema_dir / "lesson.schema.json").write_text(
        json.dumps(schema or LessonPacket.model_json_schema()), encoding="utf-8"
    )
    for lesson_id, packet in packets.items():
        (lessons_dir / f"{lesson_id}.json").write_text(
            json.dumps(packet), encoding="utf-8"
        )
    if include_catalog:
        catalog = catalog or {
            "lessons": [
                {"lesson_id": lesson_id, "position": position}
                for position, lesson_id in enumerate(packets)
            ]
        }
        (root / "dist" / "catalog.json").write_text(
            json.dumps(catalog), encoding="utf-8"
        )
    return root
