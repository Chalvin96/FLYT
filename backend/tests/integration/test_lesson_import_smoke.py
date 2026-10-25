import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.content_service import LessonContentService
from flyt.content.exceptions import LessonPacketError
from scripts.import_lessons import load_lesson_import_or_raise
from scripts.import_lessons import run
from tests.helpers.lesson_import_builder import build_import_dir
from tests.helpers.lesson_packets import exercise_for

pytestmark = pytest.mark.anyio

K_FIXTURE = Path(__file__).parent.parent / "fixtures" / "e2e" / "lesson-data"
K_EXPECTED_IMPORTED_LESSON_COUNT = 3


async def test_lesson_import_given_committed_catalog_expect_active_content(
    db: AsyncSession,
) -> None:
    lesson_import = load_lesson_import_or_raise(K_FIXTURE)

    service = LessonContentService(db)
    revision = await service.import_lesson_content(lesson_import, source=str(K_FIXTURE))
    await db.flush()

    assert revision.is_active
    assert revision.lesson_count == lesson_import.lesson_count
    lessons = (await db.scalars(select(Lesson).order_by(Lesson.release_order))).all()
    assert [lesson.source_id for lesson in lessons] == [
        item.entry.lesson_id for item in lesson_import.lessons
    ]
    assert lessons[0].source_id == "operations_tour"

    cards = (
        await db.scalars(
            select(FlashCard)
            .join(CardPool, FlashCard.pool_id == CardPool.id)
            .where(CardPool.lesson_id == lessons[0].id)
        )
    ).all()
    assert {card.type for card in cards} >= {
        CardType.CHOOSE,
        CardType.BUILD,
        CardType.WRITE,
        CardType.JUDGE,
        CardType.MATCH_PAIRS,
    }


async def test_lesson_import_given_reimport_expect_stable_lesson_and_card_ids(
    db: AsyncSession,
) -> None:
    lesson_import = load_lesson_import_or_raise(K_FIXTURE)
    service = LessonContentService(db)

    await service.import_lesson_content(lesson_import, source="first")
    await db.flush()
    first_lessons = (await db.scalars(select(Lesson))).all()
    first_cards = (await db.scalars(select(FlashCard))).all()
    first_lesson_ids = {lesson.source_id: lesson.id for lesson in first_lessons}
    first_card_ids = {card.uuid: card.id for card in first_cards}

    await service.import_lesson_content(lesson_import, source="second")
    await db.flush()
    second_lessons = (await db.scalars(select(Lesson))).all()
    second_cards = (await db.scalars(select(FlashCard))).all()

    assert {
        lesson.source_id: lesson.id for lesson in second_lessons
    } == first_lesson_ids
    assert {card.uuid: card.id for card in second_cards} == first_card_ids
    release = await db.scalar(select(LessonRelease))
    assert release is not None
    assert release.lesson_count == K_EXPECTED_IMPORTED_LESSON_COUNT


@pytest.mark.parametrize(
    ("initial_kind", "replacement_kind"),
    [("grammar", "communicative"), ("communicative", None), (None, "communicative")],
)
async def test_lesson_import_given_reclassified_packet_expect_updated_kind_and_stable_identity(
    db: AsyncSession,
    tmp_path: Path,
    initial_kind: str | None,
    replacement_kind: str | None,
) -> None:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    packet_path = root / "dist/lessons/lesson-a.json"
    packet = json.loads(packet_path.read_text())
    if initial_kind is None:
        packet.pop("kind")
    else:
        packet["kind"] = initial_kind
    packet_path.write_text(json.dumps(packet))
    service = LessonContentService(db)
    await service.import_lesson_content(
        load_lesson_import_or_raise(root), source=str(root)
    )
    lesson_id = await db.scalar(select(Lesson.id))
    if replacement_kind is None:
        packet.pop("kind")
    else:
        packet["kind"] = replacement_kind
    packet_path.write_text(json.dumps(packet))
    replacement = load_lesson_import_or_raise(root)

    await service.import_lesson_content(replacement, source=str(root))

    db.expunge_all()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    assert lesson.id == lesson_id
    assert lesson.kind == replacement_kind
    assert lesson.packet_json["kind"] == replacement_kind


async def test_lesson_import_dry_run_given_zero_addable_group_expect_same_rejection_and_unchanged_state(
    db: AsyncSession, tmp_path: Path
) -> None:
    valid_root = build_import_dir(
        tmp_path / "valid",
        lesson_ids=["lesson-a"],
        exercises=[exercise_for("choose")],
    )
    await LessonContentService(db).import_lesson_content(
        load_lesson_import_or_raise(valid_root), source=str(valid_root)
    )
    await db.flush()
    lesson_ids_before = set((await db.scalars(select(Lesson.id))).all())
    card_ids_before = set((await db.scalars(select(FlashCard.id))).all())
    assert lesson_ids_before and card_ids_before

    invalid_root = build_import_dir(tmp_path / "invalid", lesson_ids=["lesson-a"])
    packet_path = invalid_root / "dist" / "lessons" / "lesson-a.json"
    packet = json.loads(packet_path.read_text())
    packet["objectives"].append({"id": "obj-2", "statement": "Use it again."})
    review_exercise = exercise_for("build")
    review_exercise["id"] = "review_build"
    packet["exercises"].append(review_exercise)
    packet["content"].append({"kind": "exercise", "id": "review_build"})
    packet["practice_groups"][0]["exercise_ids"] = ["review_build"]
    packet["practice_groups"].append(
        {
            "id": "practice-obj-2",
            "objective_id": "obj-2",
            "exercise_ids": ["ex-choose", "ex-build"],
        }
    )
    packet_path.write_text(json.dumps(packet))

    with pytest.raises(LessonPacketError) as exc_info:
        load_lesson_import_or_raise(invalid_root)
    assert "lesson-a" in str(exc_info.value)
    assert "practice-obj-2" in str(exc_info.value)

    with pytest.raises(LessonPacketError):
        await run(str(invalid_root), dry_run=True)

    assert set((await db.scalars(select(Lesson.id))).all()) == lesson_ids_before
    assert set((await db.scalars(select(FlashCard.id))).all()) == card_ids_before
