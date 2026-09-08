"""Estimated-minutes projection over v4 packets."""

from http import HTTPStatus
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lessons.content_service import LessonContentService
from scripts.import_lessons import load_lesson_import_or_raise
from tests.factories import UserFactory
from tests.helpers.auth import authenticate
from tests.helpers.lesson_import_builder import build_import_dir

pytestmark = pytest.mark.anyio

K_EXPECTED_ESTIMATED_MINUTES = 4


async def test_list_lessons_given_two_sections_two_exercises_expect_six_minutes(
    client: AsyncClient,
    db: AsyncSession,
    tmp_path: Path,
) -> None:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    packet_path = root / "dist" / "lessons" / "lesson-a.json"
    import json

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
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    # 2 sections * 45s + 2 exercises * 60s = 210s => 4 minutes
    assert response.json()[0]["estimated_minutes"] == K_EXPECTED_ESTIMATED_MINUTES
