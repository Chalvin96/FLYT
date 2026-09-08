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
from scripts.import_lessons import load_lesson_import_or_raise

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
        CardType.SPEAK,
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
