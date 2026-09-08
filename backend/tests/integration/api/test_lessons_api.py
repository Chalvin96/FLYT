"""Lesson v4 API contract tests."""

from http import HTTPStatus
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import UserCard
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.content_service import LessonContentService
from scripts.import_lessons import load_lesson_import_or_raise
from tests.factories import UserFactory
from tests.helpers.auth import authenticate
from tests.helpers.lesson_import_builder import build_import_dir

pytestmark = pytest.mark.anyio


@pytest.fixture
async def imported_lesson(db: AsyncSession, tmp_path: Path) -> Lesson:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    return lesson


async def test_list_lessons_given_active_release_expect_flat_summaries(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [item["source_id"] for item in body] == ["lesson-a"]
    assert body[0]["state"] == "not_started"
    assert body[0]["estimated_minutes"] >= 1
    assert body[0]["last_activity_at"] is None
    assert "chapters" not in body[0]


async def test_list_lessons_given_started_progress_expect_last_activity_at(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    await client.post(f"/lessons/{imported_lesson.id}/start")

    response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    assert response.json()[0]["last_activity_at"] is not None


async def test_get_lesson_given_v4_packet_expect_canonical_detail(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get(f"/lessons/{imported_lesson.id}")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["packet"]["schema_version"] == "4.0"
    assert body["packet"]["id"] == "lesson-a"
    assert {e["id"] for e in body["packet"]["exercises"]} == {
        "ex-choose",
        "ex-speak",
    }
    assert body["progress"] is None
    assert "steps" not in body
    assert "elements" not in body


async def test_start_lesson_given_two_calls_expect_idempotent_enrollment(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    first = await client.post(f"/lessons/{imported_lesson.id}/start")
    second = await client.post(f"/lessons/{imported_lesson.id}/start")

    assert first.status_code == HTTPStatus.OK
    assert second.status_code == HTTPStatus.OK
    assert first.json()["completed_exercise_ids"] == []
    user_cards = (await db.scalars(select(UserCard))).all()
    assert len(user_cards) == 1


async def test_complete_exercise_given_authored_id_expect_progress_by_id(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    await client.post(f"/lessons/{imported_lesson.id}/start")

    response = await client.post(
        f"/lessons/{imported_lesson.id}/exercises/ex-speak/complete"
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["completed_exercise_ids"] == ["ex-speak"]


async def test_complete_exercise_given_unknown_id_expect_404(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    await client.post(f"/lessons/{imported_lesson.id}/start")

    response = await client.post(
        f"/lessons/{imported_lesson.id}/exercises/ghost/complete"
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


async def test_complete_lesson_given_all_exercises_expect_completion(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    await client.post(f"/lessons/{imported_lesson.id}/start")
    await client.post(f"/lessons/{imported_lesson.id}/exercises/ex-choose/complete")
    await client.post(f"/lessons/{imported_lesson.id}/exercises/ex-speak/complete")

    response = await client.post(f"/lessons/{imported_lesson.id}/complete")

    assert response.status_code == HTTPStatus.OK
    listing = (await client.get("/lessons")).json()
    assert listing[0]["state"] == "completed"


async def test_legacy_sections_route_given_v4_expect_404(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons/sections")

    assert response.status_code in {404, 405, 422}


async def test_get_lesson_given_missing_id_expect_404(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons/999999")

    assert response.status_code == HTTPStatus.NOT_FOUND
