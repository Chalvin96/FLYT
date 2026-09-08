#!/usr/bin/env python3
"""Import or explicitly retire lesson content.

Usage:
    python scripts/import_lessons.py <import-dir-or-tarball-or-https-url> [--dry-run]
    python scripts/import_lessons.py --retire-lesson <stable-lesson-id> [--dry-run]

A current import contains ``dist/catalog.json``, the packet schema, and
self-describing packets below ``dist/lessons/``. The catalog is the source of
truth: omitting a packet removes its lesson and learner-owned state.
"""

from __future__ import annotations

import argparse
import asyncio
from contextlib import contextmanager
import hashlib
from pathlib import Path
import tempfile
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError

from flyt.apps.lessons.deps import build_lesson_content_service
from flyt.apps.lessons.types import LessonImportBatch
from flyt.apps.lessons.types import LessonImportItem
from flyt.content.exceptions import LessonImportError
from flyt.content.schemas import LessonCatalog
from flyt.content.schemas import LessonCatalogEntry
from flyt.content.schemas import LessonPacket
from flyt.content.validation import parse_lesson_catalog_or_raise
from flyt.content.validation import parse_lesson_packet_or_raise
from flyt.content.validation import validate_packet_graph_or_raise
from flyt.core.db import AsyncSessionLocal
from flyt.libs.utils.json import read_json_file
from scripts._download_utils import download_tarball
from scripts._download_utils import is_local_tarball
from scripts._download_utils import is_remote_source
from scripts._download_utils import safe_extract_tarball

K_CATALOG_RELPATH = Path("dist/catalog.json")
K_LESSONS_RELPATH = Path("dist/lessons")
K_SCHEMA_RELPATH = Path("dist/schema/lesson.schema.json")
K_AUDIO_RELPATH = Path("dist/audio/lessons")
K_PACKET_PROPERTIES = frozenset(
    {
        "schema_version",
        "id",
        "kind",
        "language",
        "title",
        "cefr_level",
        "goal",
        "objectives",
        "content",
        "sections",
        "exercises",
        "practice_groups",
        "media",
    }
)
K_REQUIRED_PACKET_PROPERTIES = frozenset(
    K_PACKET_PROPERTIES - {"schema_version", "language"}
)


def find_lesson_import_root_or_raise(root_dir: Path) -> Path:
    if _is_import_root(root_dir):
        return root_dir
    for candidate in sorted(root_dir.rglob(K_CATALOG_RELPATH.name)):
        if candidate.parent.name != "dist":
            continue
        import_root = candidate.parent.parent
        if _is_import_root(import_root):
            return import_root
    raise LessonImportError(
        f"No lesson import found in {root_dir}: {K_CATALOG_RELPATH} is required"
    )


def load_lesson_import_or_raise(root: Path) -> LessonImportBatch:
    return _load_catalog_import_or_raise(root.resolve())


@contextmanager
def resolve_lesson_import_root(source: str):
    path = Path(source)

    if path.is_dir():
        yield find_lesson_import_root_or_raise(path)
        return

    with tempfile.TemporaryDirectory(prefix="lesson-import-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)

        if path.is_file() and is_local_tarball(path):
            archive_path = path
        elif is_remote_source(source):
            archive_path = temp_dir / "download.tar.gz"
            print(f"Downloading {source}...")
            download_tarball(source, archive_path)
        else:
            raise LessonImportError(
                "Source must be an import directory, a local .tar.gz file, or an "
                "https URL"
            )

        extract_dir = temp_dir / "extract"
        extract_dir.mkdir()
        print(f"Extracting {archive_path.name}...")
        safe_extract_tarball(archive_path, extract_dir)
        yield find_lesson_import_root_or_raise(extract_dir)


async def run(source: str, dry_run: bool) -> None:
    with resolve_lesson_import_root(source) as root:
        print(f"Using lesson import root: {root}")
        lesson_import = load_lesson_import_or_raise(root)
        print(
            f"Validated {lesson_import.lesson_count} lesson packet(s) from "
            f"{root / 'dist' / 'catalog.json'}"
        )
        for item in lesson_import.lessons:
            audio = item.packet.media.audio
            print(
                f"  {item.entry.lesson_id}: {len(item.packet.sections)} section(s), "
                f"{len(item.packet.exercises)} exercise(s), "
                f"{len(audio)} audio asset(s)"
            )

        if dry_run:
            print("Dry run: no database or media changes were made.")
            return

        async with AsyncSessionLocal() as db:
            content_service = build_lesson_content_service(db)
            revision = await content_service.import_lesson_content(
                lesson_import, source=source
            )
            await db.commit()
        print(
            f"Imported lesson content revision #{revision.id} "
            f"({revision.lesson_count} lesson(s)). "
            "Audio uses producer-hosted URLs."
        )


async def delete_lesson(source_id: str, dry_run: bool) -> None:
    async with AsyncSessionLocal() as db:
        await build_lesson_content_service(db).delete_lesson_by_source_id(source_id)
        if dry_run:
            await db.rollback()
            print(f"Dry run: lesson {source_id!r} was not deleted.")
            return
        await db.commit()
    print(f"Deleted lesson {source_id!r} and its learner-owned state.")


def _is_import_root(root: Path) -> bool:
    return (root / K_CATALOG_RELPATH).is_file() and (root / K_LESSONS_RELPATH).is_dir()


def _read_json_or_raise(path: Path, what: str) -> Any:
    try:
        return read_json_file(path)
    except (OSError, ValueError) as exc:
        raise LessonImportError(f"Invalid {what} at {path}: {exc}") from exc


def _resolve_import_path_or_raise(root: Path, relative: Path, what: str) -> Path:
    if relative.is_absolute() or ".." in relative.parts:
        raise LessonImportError(f"Unsafe {what} path: {relative}")

    resolved_root = root.resolve()
    candidate = resolved_root / relative
    current = resolved_root
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise LessonImportError(f"Symlink is not allowed for {what}: {relative}")

    resolved = candidate.resolve()
    if not resolved.is_relative_to(resolved_root):
        raise LessonImportError(f"{what} path escapes the import root: {relative}")
    return resolved


def _schema_validator_or_raise(schema_path: Path) -> Draft202012Validator:
    schema = _read_json_or_raise(schema_path, "lesson schema")
    try:
        Draft202012Validator.check_schema(schema)
    except (SchemaError, TypeError, ValueError) as exc:
        raise LessonImportError(
            f"Invalid lesson schema at {schema_path}: {exc}"
        ) from exc
    return Draft202012Validator(schema)


def _validate_packet_schema_or_raise(
    validator: Draft202012Validator, data: object, packet_path: Path
) -> None:
    try:
        validator.validate(data)
    except JsonSchemaValidationError as exc:
        location = ".".join(str(part) for part in exc.absolute_path) or "root"
        raise LessonImportError(
            f"Packet {packet_path.name!r} does not match the lesson schema at "
            f"{location}: {exc.message}"
        ) from exc


def _validate_schema_artifact_or_raise(schema_path: Path) -> None:
    schema = _read_json_or_raise(schema_path, "lesson schema")
    if not isinstance(schema, dict):
        raise LessonImportError(
            f"Invalid lesson schema at {schema_path}: root is not an object"
        )
    if schema.get("type") != "object":
        raise LessonImportError(
            f"Invalid lesson schema at {schema_path}: root type must be object"
        )

    properties = schema.get("properties")
    if not isinstance(properties, dict):
        raise LessonImportError(
            f"Invalid lesson schema at {schema_path}: properties is not an object"
        )
    actual_properties = set(properties)
    if actual_properties != K_PACKET_PROPERTIES:
        raise LessonImportError(
            f"Lesson schema at {schema_path} has packet properties "
            f"{sorted(actual_properties)!r}, expected {sorted(K_PACKET_PROPERTIES)!r}"
        )
    for property_name, expected in (
        ("schema_version", "4.0"),
        ("language", "nb-NO"),
    ):
        property_schema = properties[property_name]
        if (
            not isinstance(property_schema, dict)
            or property_schema.get("const") != expected
        ):
            raise LessonImportError(
                f"Lesson schema at {schema_path} has an invalid "
                f"{property_name} contract"
            )

    required = schema.get("required")
    if not isinstance(required, list) or not all(
        isinstance(value, str) for value in required
    ):
        raise LessonImportError(
            f"Invalid lesson schema at {schema_path}: required is not a string list"
        )
    required_properties = set(required)
    if (
        len(required) != len(required_properties)
        or not K_REQUIRED_PACKET_PROPERTIES.issubset(required_properties)
        or not required_properties.issubset(K_PACKET_PROPERTIES)
    ):
        raise LessonImportError(
            f"Lesson schema at {schema_path} has invalid required packet fields"
        )


def _catalog_entries_by_id_or_raise(
    catalog: LessonCatalog,
) -> dict[str, LessonCatalogEntry]:
    entries_by_id: dict[str, LessonCatalogEntry] = {}
    positions: set[int] = set()
    for entry in catalog.lessons:
        if entry.lesson_id in entries_by_id:
            raise LessonImportError(
                f"Duplicate lesson id in catalog: {entry.lesson_id!r}"
            )
        if entry.position in positions:
            raise LessonImportError(f"Duplicate catalog position: {entry.position}")
        entries_by_id[entry.lesson_id] = entry
        positions.add(entry.position)

    if positions != set(range(len(catalog.lessons))):
        raise LessonImportError(
            "Catalog positions must be contiguous zero-based integers"
        )
    return entries_by_id


def _packet_paths_or_raise(root: Path) -> list[Path]:
    lessons_dir = _resolve_import_path_or_raise(
        root, K_LESSONS_RELPATH, "lesson packet directory"
    )
    if not lessons_dir.is_dir():
        raise LessonImportError(f"Missing lesson packet directory: {lessons_dir}")

    entries = sorted(lessons_dir.iterdir())
    for path in entries:
        _resolve_import_path_or_raise(root, path.relative_to(root), "lesson packet")
    nested_directories = [path for path in entries if path.is_dir()]
    if nested_directories:
        raise LessonImportError(
            "Lesson packet directory must be flat; nested directory found: "
            f"{nested_directories[0].name!r}"
        )
    paths = sorted(path for path in entries if path.name.endswith(".json"))
    if not paths:
        raise LessonImportError(f"No lesson packets found in {lessons_dir}")
    for path in paths:
        if not path.is_file():
            raise LessonImportError(
                f"Lesson packet is not a regular file: {path.name!r}"
            )
    return paths


def _validate_bundled_audio_or_raise(root: Path, packet: LessonPacket) -> set[str]:
    referenced_paths: set[str] = set()
    for asset in packet.media.audio:
        referenced_paths.add(asset.path)
        bundled_path = _resolve_import_path_or_raise(
            root,
            Path("dist") / asset.path,
            f"bundled audio asset {asset.path!r}",
        )
        if not bundled_path.exists():
            continue
        if not bundled_path.is_file():
            raise LessonImportError(
                f"Bundled audio asset {asset.path!r} is not a regular file"
            )
        if asset.sha256 is not None:
            digest = hashlib.sha256(bundled_path.read_bytes()).hexdigest()
            if digest != asset.sha256:
                raise LessonImportError(
                    f"Bundled audio asset {asset.id!r} does not match declared sha256"
                )
    return referenced_paths


def _validate_stale_audio_or_raise(root: Path, referenced_paths: set[str]) -> None:
    audio_root = _resolve_import_path_or_raise(
        root, K_AUDIO_RELPATH, "bundled audio directory"
    )
    if not audio_root.is_dir():
        return
    for path in audio_root.rglob("*"):
        relative = path.relative_to(root / "dist").as_posix()
        _resolve_import_path_or_raise(root, path.relative_to(root), "bundled audio")
        if path.is_file() and relative not in referenced_paths:
            raise LessonImportError(f"Stale bundled audio asset: {relative!r}")


def _import_digest_or_raise(root: Path) -> str:
    dist = _resolve_import_path_or_raise(root, Path("dist"), "import directory")
    if not dist.is_dir():
        raise LessonImportError(f"Missing import directory: {dist}")

    digest = hashlib.sha256()
    paths = sorted(dist.rglob("*"))
    for path in paths:
        safe_path = _resolve_import_path_or_raise(
            root, path.relative_to(root), "import file"
        )
        if not safe_path.is_file():
            continue
        relative_path = path.relative_to(root).as_posix()
        relative = relative_path.encode("utf-8")
        data = safe_path.read_bytes()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return digest.hexdigest()


def _load_catalog_import_or_raise(root: Path) -> LessonImportBatch:
    schema_path = _resolve_import_path_or_raise(root, K_SCHEMA_RELPATH, "lesson schema")
    catalog_path = _resolve_import_path_or_raise(
        root, K_CATALOG_RELPATH, "lesson catalog"
    )
    if not schema_path.is_file():
        raise LessonImportError(
            f"Import is missing the lesson schema: {schema_path}. "
            "A current import must ship dist/schema/lesson.schema.json."
        )
    if not catalog_path.is_file():
        raise LessonImportError(f"Missing lesson catalog: {catalog_path}")

    schema_validator = _schema_validator_or_raise(schema_path)
    _validate_schema_artifact_or_raise(schema_path)
    catalog = parse_lesson_catalog_or_raise(
        _read_json_or_raise(catalog_path, "lesson catalog")
    )
    entries_by_id = _catalog_entries_by_id_or_raise(catalog)
    packet_paths = _packet_paths_or_raise(root)
    packet_ids = {path.stem for path in packet_paths}
    catalog_ids = set(entries_by_id)
    if packet_ids != catalog_ids:
        raise LessonImportError(
            "Catalog and packet inventories differ: "
            f"catalog-only={sorted(catalog_ids - packet_ids)!r}, "
            f"packet-only={sorted(packet_ids - catalog_ids)!r}"
        )

    lessons: list[LessonImportItem] = []
    referenced_audio_paths: set[str] = set()
    for packet_path in sorted(
        packet_paths, key=lambda path: entries_by_id[path.stem].position
    ):
        raw_packet = _read_json_or_raise(
            packet_path, f"lesson packet {packet_path.name!r}"
        )
        _validate_packet_schema_or_raise(schema_validator, raw_packet, packet_path)
        packet = parse_lesson_packet_or_raise(raw_packet)
        if packet.id != packet_path.stem:
            raise LessonImportError(
                f"Packet filename {packet_path.name!r} does not match packet id {packet.id!r}"
            )
        validate_packet_graph_or_raise(packet)
        referenced_audio_paths.update(_validate_bundled_audio_or_raise(root, packet))
        lessons.append(LessonImportItem(entry=entries_by_id[packet.id], packet=packet))

    _validate_stale_audio_or_raise(root, referenced_audio_paths)
    return LessonImportBatch(
        catalog=catalog,
        digest=_import_digest_or_raise(root),
        lessons=lessons,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?")
    parser.add_argument("--retire-lesson", metavar="STABLE_LESSON_ID")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if (args.source is None) == (args.retire_lesson is None):
        parser.error("provide exactly one import source or --retire-lesson")
    if args.retire_lesson is not None:
        asyncio.run(delete_lesson(args.retire_lesson, args.dry_run))
    else:
        asyncio.run(run(args.source, args.dry_run))
