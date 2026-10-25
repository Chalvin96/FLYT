"""Lesson v4 API contract tests."""

from http import HTTPStatus
import json
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
from tests.factories import LessonFactory
from tests.factories import LessonReleaseFactory
from tests.factories import UserLessonProgressFactory
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


@pytest.mark.parametrize(
    ("kind", "expected_ids"),
    [
        ("communicative", ["comm-later", "comm-first"]),
        ("grammar", ["grammar"]),
        (None, ["comm-later", "grammar", "comm-first", "legacy"]),
    ],
)
async def test_list_lessons_given_mixed_kinds_expect_active_matches_in_curriculum_order(
    client: AsyncClient,
    db: AsyncSession,
    tmp_path: Path,
    kind: str | None,
    expected_ids: list[str],
) -> None:
    root = build_import_dir(
        tmp_path, lesson_ids=["comm-later", "grammar", "comm-first", "legacy"]
    )
    for lesson_id, packet_kind in (
        ("comm-later", "communicative"),
        ("comm-first", "communicative"),
        ("legacy", None),
    ):
        packet_path = root / "dist/lessons" / f"{lesson_id}.json"
        packet = json.loads(packet_path.read_text())
        if packet_kind is None:
            packet.pop("kind")
        else:
            packet["kind"] = packet_kind
        packet_path.write_text(json.dumps(packet))
    schema_path = root / "dist/schema/lesson.schema.json"
    schema = json.loads(schema_path.read_text())
    if "kind" in schema["required"]:
        schema["required"].remove("kind")
    schema_path.write_text(json.dumps(schema))
    await LessonContentService(db).import_lesson_content(
        load_lesson_import_or_raise(root), source=str(root)
    )
    inactive = await LessonReleaseFactory.create(is_active=False)
    await LessonFactory.create(release_id=inactive.id, kind="communicative")
    user = await UserFactory.create()
    first_lesson = await db.scalar(
        select(Lesson).where(Lesson.source_id == "comm-later")
    )
    assert first_lesson is not None
    await UserLessonProgressFactory.create(
        user_id=user.id,
        lesson_id=first_lesson.id,
        completed_exercise_ids_json=["ex-choose"],
    )
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get("/lessons", params={"kind": kind} if kind else {})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [item["source_id"] for item in body] == expected_ids
    if kind != "grammar":
        assert body[0]["state"] == "in_progress"
        assert body[0]["last_activity_at"] is not None
    if kind is None:
        assert body[-1]["kind"] is None
    else:
        assert all(item["kind"] == kind for item in body)


async def test_list_lessons_given_invalid_kind_expect_validation_error(
    client: AsyncClient, db: AsyncSession
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/lessons", params={"kind": "unknown"})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_list_lessons_given_unauthenticated_kind_query_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.get("/lessons", params={"kind": "communicative"})

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_get_lesson_given_unknown_kind_expect_null_classification(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    imported_lesson.kind = None
    await db.flush()
    lesson_id = imported_lesson.id
    user = await UserFactory.create()
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get(f"/lessons/{lesson_id}")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["kind"] is None


async def test_list_lessons_given_active_release_expect_flat_summaries(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.expunge_all()

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
    db.expunge_all()

    response = await client.get("/lessons")

    assert response.status_code == HTTPStatus.OK
    assert response.json()[0]["last_activity_at"] is not None


async def test_get_lesson_given_v4_packet_expect_canonical_detail(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.expunge_all()

    response = await client.get(f"/lessons/{imported_lesson.id}")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["packet"]["schema_version"] == "4.0"
    assert body["packet"]["id"] == "lesson-a"
    assert {e["id"] for e in body["packet"]["exercises"]} == {
        "ex-choose",
        "ex-build",
    }
    assert body["progress"] is None
    assert "steps" not in body
    assert "elements" not in body


async def test_get_lesson_given_reloaded_progress_expect_progress_in_detail(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    await client.post(f"/lessons/{imported_lesson.id}/start")
    await client.post(f"/lessons/{imported_lesson.id}/exercises/ex-choose/complete")
    db.expunge_all()

    response = await client.get(f"/lessons/{imported_lesson.id}")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["progress"]["completed_exercise_ids"] == ["ex-choose"]


async def test_start_lesson_given_two_calls_expect_idempotent_enrollment(
    client: AsyncClient, db: AsyncSession, imported_lesson: Lesson
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.expunge_all()

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
    db.expunge_all()

    response = await client.post(
        f"/lessons/{imported_lesson.id}/exercises/ex-build/complete"
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["completed_exercise_ids"] == ["ex-build"]


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
    await client.post(f"/lessons/{imported_lesson.id}/exercises/ex-build/complete")
    db.expunge_all()

    response = await client.post(f"/lessons/{imported_lesson.id}/complete")

    assert response.status_code == HTTPStatus.OK
    db.expunge_all()
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


@pytest.mark.parametrize(
    ("method", "suffix"),
    [
        ("GET", ""),
        ("POST", "/start"),
        ("POST", "/exercises/ex-choose/complete"),
        ("POST", "/complete"),
    ],
)
async def test_lesson_access_given_inactive_release_expect_not_found(
    client: AsyncClient,
    db: AsyncSession,
    imported_lesson: Lesson,
    method: str,
    suffix: str,
) -> None:
    from flyt.apps.lessons.models import LessonRelease

    user = await UserFactory.create()
    await authenticate(client, user)
    started = await client.post(f"/lessons/{imported_lesson.id}/start")
    assert started.status_code == HTTPStatus.OK
    lesson_id = imported_lesson.id
    release = await db.get(LessonRelease, imported_lesson.release_id)
    assert release is not None
    release.is_active = False
    await db.flush()
    db.expunge_all()

    response = await client.request(method, f"/lessons/{lesson_id}{suffix}")

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "LESSON_NOT_FOUND"
