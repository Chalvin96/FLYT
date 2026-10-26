"""Estimated-minutes projection over v4 packets."""

from http import HTTPStatus
import json
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lessons.content_service import LessonContentService
from flyt.apps.lessons.models import Lesson
from scripts.import_lessons import load_lesson_import_or_raise
from tests.factories import UserFactory
from tests.helpers.auth import authenticate
from tests.helpers.lesson_import_builder import build_import_dir
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

pytestmark = pytest.mark.anyio

K_EXPECTED_ESTIMATED_MINUTES = 4
K_DEFAULT_ESTIMATED_MINUTES = 3


async def test_import_lessons_given_two_sections_two_exercises_expect_stored_four_minutes(
    client: AsyncClient,
    db: AsyncSession,
    tmp_path: Path,
) -> None:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    packet_path = root / "dist" / "lessons" / "lesson-a.json"
    packet = json.loads(packet_path.read_text())
    packet["sections"].append(
        {
            "kind": "section",
            "id": "sec-2",
            "role": "recap",
            "title": "Recap",
            "objective_ids": ["obj-1"],
            "blocks": [],
        }
    )
    packet["content"].append({"kind": "section", "id": "sec-2"})
    packet_path.write_text(json.dumps(packet))
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    db.expunge_all()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    assert lesson.estimated_minutes == K_EXPECTED_ESTIMATED_MINUTES
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    assert response.json()[0]["estimated_minutes"] == K_EXPECTED_ESTIMATED_MINUTES


async def test_list_lessons_given_imported_packet_expect_summary_without_packet_read(
    client: AsyncClient, db: AsyncSession, tmp_path: Path
) -> None:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    await LessonContentService(db).import_lesson_content(
        load_lesson_import_or_raise(root), source=str(root)
    )
    user = await UserFactory.create()
    await authenticate(client, user)
    db.expunge_all()

    with capture_sql(db) as executed:
        response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    assert response.json()[0]["estimated_minutes"] == K_DEFAULT_ESTIMATED_MINUTES
    lesson_queries = statements_reading(executed, "lesson_lessons")
    assert lesson_queries
    assert all("packet_json" not in statement for statement, _ in lesson_queries)


async def test_import_lessons_given_reconciled_packet_expect_updated_estimate(
    db: AsyncSession, tmp_path: Path
) -> None:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    service = LessonContentService(db)
    await service.import_lesson_content(
        load_lesson_import_or_raise(root), source=str(root)
    )
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    lesson_id = lesson.id
    assert lesson.estimated_minutes == K_DEFAULT_ESTIMATED_MINUTES
    packet_path = root / "dist/lessons/lesson-a.json"
    packet = json.loads(packet_path.read_text())
    packet["sections"].append(
        {
            "kind": "section",
            "id": "recap",
            "role": "recap",
            "title": "Recap",
            "objective_ids": ["obj-1"],
            "blocks": [],
        }
    )
    packet["content"].append({"kind": "section", "id": "recap"})
    packet_path.write_text(json.dumps(packet))

    await service.import_lesson_content(
        load_lesson_import_or_raise(root), source=str(root)
    )
    db.expunge_all()

    reloaded = await db.get(Lesson, lesson_id)
    assert reloaded is not None
    assert reloaded.estimated_minutes == K_EXPECTED_ESTIMATED_MINUTES
