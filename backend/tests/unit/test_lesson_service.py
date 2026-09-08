"""Lesson runtime and content tests."""

import asyncio
import json
from datetime import UTC
from datetime import datetime
from pathlib import Path
from typing import Any
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import LESSON_REVIEW_AUDIO_KEY
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import FlashcardCardService
from flyt.apps.flashcards.review_service import FlashcardReviewService
from flyt.apps.lessons.exceptions import ExerciseEvaluationUnavailableError
from flyt.apps.lessons.exceptions import ExerciseNotFoundError
from flyt.apps.lessons.exceptions import ExerciseResponseInvalidError
from flyt.apps.lessons.exceptions import LessonNotCompleteError
from flyt.apps.lessons.exceptions import LessonNotStartedError
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lessons.content_service import LessonContentService
from flyt.apps.lessons.runtime_service import LessonService
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.stats.services import StatsService
from flyt.apps.users.models import User
from flyt.apps.users.services import UserLemmaService
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.core.config import settings
from scripts.import_lessons import load_lesson_import_or_raise
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import StatsReviewLogFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserSettingsFactory

from tests.helpers.lesson_import_builder import build_import_dir
from tests.helpers.lesson_packets import exercise_for

EXPECTED_RESTORED_STABILITY = 8.5
EXPECTED_RESTORED_DIFFICULTY = 6.2
EXPECTED_RESTORED_STEP = 2
EXPECTED_REPLACED_FLASHCARD_COUNT = 2
EXPECTED_REORDERED_LESSON_COUNT = 2
EXPECTED_LESSON_POOL_COUNT = 2

pytestmark = pytest.mark.anyio


@pytest.fixture
def service(db: AsyncSession) -> LessonService:
    return LessonService(db)


async def import_lesson_import_dir(
    db: AsyncSession, tmp_path: Path, **builder_kwargs
) -> None:
    root = build_import_dir(tmp_path, **builder_kwargs)
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()


def lesson_review_service(session: AsyncSession) -> FlashcardReviewService:
    return FlashcardReviewService(
        session,
        StatsService(session, query_service=StatsQueryService(session)),
        UserLemmaService(session),
        FlashcardCardService(session, UserLemmaService(session)),
    )


async def import_two_pool_lesson(db: AsyncSession, tmp_path: Path) -> Lesson:
    root = build_import_dir(tmp_path, lesson_ids=["lesson-a"])
    packet_path = root / "dist" / "lessons" / "lesson-a.json"
    packet = json.loads(packet_path.read_text())
    packet["objectives"].append({"id": "obj-2", "statement": "Use it again."})
    packet["practice_groups"][0]["exercise_ids"] = ["ex-choose"]
    packet["practice_groups"].append(
        {
            "id": "practice-obj-2",
            "objective_id": "obj-2",
            "exercise_ids": ["ex-speak"],
        }
    )
    packet_path.write_text(json.dumps(packet))
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    return lesson


async def test_lesson_content_import_given_catalog_order_expect_release_ordered_lessons(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["zzz", "aaa"])

    release = await db.scalar(select(LessonRelease))
    assert release is not None and release.is_active
    lessons = (await db.scalars(select(Lesson).order_by(Lesson.release_order))).all()
    assert [lesson.source_id for lesson in lessons] == ["zzz", "aaa"]


async def test_lesson_content_import_given_practice_groups_expect_pools_and_variants(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])

    pools = (await db.scalars(select(CardPool))).all()
    assert [pool.key for pool in pools] == ["practice-obj-1"]

    cards = (await db.scalars(select(FlashCard).order_by(FlashCard.id))).all()
    assert [card.type for card in cards] == [CardType.CHOOSE, CardType.SPEAK]
    payloads = [card.payload_json for card in cards]
    assert payloads[0]["id"] == "ex-choose"
    assert payloads[1]["id"] == "ex-speak"
    assert all(card.pool_id == pools[0].id for card in cards)
    assert all(card.uuid is not None for card in cards)


async def test_lesson_content_import_given_group_move_expect_review_state_preserved(
    db: AsyncSession, tmp_path: Path
) -> None:
    first_root = tmp_path / "one"
    await import_lesson_import_dir(
        db,
        first_root,
        lesson_ids=["lesson-a"],
        exercises=[exercise_for("choose")],
    )
    old_pool = await db.scalar(select(CardPool))
    old_card = await db.scalar(select(FlashCard))
    assert old_pool is not None and old_card is not None

    user = await UserFactory.create()
    reviewed_at = datetime(2026, 8, 1, 12, 0, 0)
    due_at = datetime(2026, 8, 8, 12, 0, 0)
    user_card = await UserCardFactory.create(
        user=user,
        pool=old_pool,
        last_shown_card=old_card,
        fsrs_stability=8.5,
        fsrs_difficulty=6.2,
        fsrs_step=2,
        last_review_at=reviewed_at,
        introduced_at=datetime(2026, 7, 1, 12, 0, 0),
        due_at=due_at,
        state=CardState.LEARNING,
    )
    review_log = await StatsReviewLogFactory.create(
        user_card=user_card,
        rating=4,
        reviewed_at=reviewed_at,
    )

    second_root = build_import_dir(
        tmp_path / "two",
        lesson_ids=["lesson-a"],
        exercises=[exercise_for("choose")],
    )
    packet_path = second_root / "dist" / "lessons" / "lesson-a.json"
    packet = json.loads(packet_path.read_text())
    packet["practice_groups"][0]["id"] = "practice-renamed"
    packet_path.write_text(json.dumps(packet))
    loaded = load_lesson_import_or_raise(second_root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(second_root))
    await db.flush()

    new_pool = await db.scalar(select(CardPool))
    new_card = await db.scalar(select(FlashCard))
    updated_user_card = await db.scalar(
        select(UserCard).where(UserCard.user_id == user.id)
    )
    preserved_log = await db.scalar(
        select(StatsReviewLog).where(StatsReviewLog.user_id == user.id)
    )
    assert new_pool is not None and new_card is not None
    assert updated_user_card is not None and preserved_log is not None
    assert new_pool.key == "practice-renamed"
    assert new_pool.id != old_pool.id
    assert new_card.id == old_card.id
    assert updated_user_card.id == user_card.id
    assert updated_user_card.pool_id == new_pool.id
    assert updated_user_card.last_shown_card_id == new_card.id
    assert updated_user_card.fsrs_stability == EXPECTED_RESTORED_STABILITY
    assert updated_user_card.fsrs_difficulty == EXPECTED_RESTORED_DIFFICULTY
    assert updated_user_card.fsrs_step == EXPECTED_RESTORED_STEP
    assert updated_user_card.last_review_at == reviewed_at
    assert updated_user_card.due_at == due_at
    assert updated_user_card.state == CardState.LEARNING
    assert preserved_log.id == review_log.id
    assert preserved_log.user_card_id == updated_user_card.id


async def test_lesson_content_import_given_exercise_audio_expect_review_snapshot(
    db: AsyncSession, tmp_path: Path
) -> None:
    exercise = exercise_for("speak")
    exercise["audio_id"] = "audio-model"

    await import_lesson_import_dir(
        db,
        tmp_path,
        lesson_ids=["lesson-a"],
        exercises=[exercise],
        with_audio=True,
    )

    card = await db.scalar(select(FlashCard))
    assert card is not None
    assert card.payload_json[LESSON_REVIEW_AUDIO_KEY]["id"] == "audio-model"
    assert card.payload_json[LESSON_REVIEW_AUDIO_KEY]["url"].endswith(
        "/00000000-0000-4000-8000-000000000001.wav"
    )


async def test_activate_lesson_import_given_legacy_audio_snapshot_expect_repair(
    db: AsyncSession, tmp_path: Path
) -> None:
    exercise = exercise_for("speak")
    exercise["audio_id"] = "audio-model"

    await import_lesson_import_dir(
        db,
        tmp_path / "one",
        lesson_ids=["lesson-a"],
        exercises=[exercise],
        with_audio=True,
    )
    card = await db.scalar(select(FlashCard))
    assert card is not None
    card.payload_json = {
        key: value
        for key, value in card.payload_json.items()
        if key != LESSON_REVIEW_AUDIO_KEY
    }
    card_id = card.id
    await db.flush()

    await import_lesson_import_dir(
        db,
        tmp_path / "two",
        lesson_ids=["lesson-a"],
        exercises=[exercise],
        with_audio=True,
    )

    repaired = await db.scalar(select(FlashCard))
    assert repaired is not None
    assert repaired.id == card_id
    assert repaired.payload_json[LESSON_REVIEW_AUDIO_KEY]["id"] == "audio-model"


async def test_lesson_content_import_given_omitted_lesson_expect_deletion(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path / "one", lesson_ids=["lesson-a"])
    first_lesson = await db.scalar(select(Lesson))
    assert first_lesson is not None
    first_lesson_id = first_lesson.id
    first_pool = await db.scalar(select(CardPool))
    assert first_pool is not None
    first_card = await db.scalar(select(FlashCard))
    assert first_card is not None
    user = await UserFactory.create()
    user_card = await UserCardFactory.create(
        user=user,
        pool=first_pool,
        last_shown_card=first_card,
    )
    await StatsReviewLogFactory.create(
        user_card=user_card,
    )
    db.add(
        UserLessonProgress(
            user_id=user.id,
            lesson_id=first_lesson.id,
            completed_exercise_ids_json=["ex-choose"],
        )
    )
    await db.flush()

    await import_lesson_import_dir(db, tmp_path / "two", lesson_ids=["lesson-b"])
    await db.flush()

    releases = (await db.scalars(select(LessonRelease))).all()
    assert len(releases) == 1
    lessons = (await db.scalars(select(Lesson))).all()
    assert [lesson.source_id for lesson in lessons] == ["lesson-b"]
    assert lessons[0].id != first_lesson_id
    assert (await db.scalar(select(func.count(CardPool.id)))) == 1
    assert (
        await db.scalar(select(func.count(FlashCard.id)))
    ) == EXPECTED_REPLACED_FLASHCARD_COUNT
    assert (await db.scalar(select(func.count(UserCard.id)))) == 0
    assert (await db.scalar(select(func.count(StatsReviewLog.id)))) == 0
    assert (await db.scalar(select(func.count(UserLessonProgress.id)))) == 0


async def test_lesson_content_import_given_reordered_catalog_expect_catalog_order(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(
        db, tmp_path / "one", lesson_ids=["lesson-a", "lesson-b"]
    )
    await import_lesson_import_dir(
        db, tmp_path / "two", lesson_ids=["lesson-b", "lesson-a"]
    )

    lessons = (await db.scalars(select(Lesson).order_by(Lesson.release_order))).all()
    release = await db.scalar(select(LessonRelease))

    assert [lesson.source_id for lesson in lessons] == ["lesson-b", "lesson-a"]
    assert [lesson.release_order for lesson in lessons] == [1, 2]
    assert (
        release is not None and release.lesson_count == EXPECTED_REORDERED_LESSON_COUNT
    )


async def test_lesson_content_import_given_identical_release_expect_replacement(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path / "one", lesson_ids=["lesson-a"])
    await import_lesson_import_dir(db, tmp_path / "two", lesson_ids=["lesson-a"])

    releases = (await db.scalars(select(LessonRelease))).all()
    lessons = (await db.scalars(select(Lesson))).all()
    assert len(releases) == 1
    assert [lesson.source_id for lesson in lessons] == ["lesson-a"]


async def test_start_lesson_given_two_starts_expect_single_enrollment(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))
    service = LessonService(db)

    first = await service.start_lesson(user.id, lesson.id)
    second = await service.start_lesson(user.id, lesson.id)

    assert first.id == second.id
    assert await db.scalar(select(func.count(UserCard.id))) == 1
    assert await db.scalar(select(func.count(UserLessonProgress.id))) == 1


async def test_lesson_enrollment_given_daily_limit_reached_expect_lesson_cards_still_available(
    db: AsyncSession, tmp_path: Path
) -> None:
    """Starting a lesson explicitly activates its cards beyond the daily cap."""
    lesson = await import_two_pool_lesson(db, tmp_path)
    user = await UserFactory.create()
    await UserSettingsFactory.create(user=user, daily_new_limit=1)
    lesson_pool_ids = set(
        (
            await db.scalars(select(CardPool.id).where(CardPool.lesson_id == lesson.id))
        ).all()
    )
    assert len(lesson_pool_ids) == EXPECTED_LESSON_POOL_COUNT

    unrelated_pool = await CardPoolFactory.create()
    await FlashCardFactory.create(pool=unrelated_pool, is_addable=True)
    await UserCardFactory.create(
        user=user,
        pool=unrelated_pool,
        state=CardState.NEW,
        introduced_at=datetime.now(UTC).replace(tzinfo=None),
    )

    await LessonService(db).start_lesson(user.id, lesson.id)

    served_pool_ids = {
        due_card.user_card.pool_id
        for due_card in await lesson_review_service(db).issue_due_cards(user.id)
    }
    assert served_pool_ids == lesson_pool_ids | {unrelated_pool.id}


async def test_lesson_enrollment_given_pool_without_addable_variant_expect_not_enrolled(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    lesson_pool_ids = set(
        (
            await db.scalars(select(CardPool.id).where(CardPool.lesson_id == lesson.id))
        ).all()
    )
    assert lesson_pool_ids
    lesson_cards = (
        await db.scalars(
            select(FlashCard).where(FlashCard.pool_id.in_(lesson_pool_ids))
        )
    ).all()
    assert lesson_cards
    for card in lesson_cards:
        card.is_addable = False
    await db.flush()

    user = await UserFactory.create()
    await LessonService(db).start_lesson(user.id, lesson.id)

    enrolled_cards = (
        await db.scalars(
            select(UserCard)
            .where(UserCard.user_id == user.id)
            .where(UserCard.pool_id.in_(lesson_pool_ids))
        )
    ).all()
    assert not enrolled_cards


async def test_complete_exercise_given_authored_id_expect_idempotent_progress(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))
    service = LessonService(db)
    await service.start_lesson(user.id, lesson.id)

    await service.complete_exercise(user.id, lesson.id, "ex-choose")
    await service.complete_exercise(user.id, lesson.id, "ex-choose")

    progress = await db.scalar(select(UserLessonProgress))
    assert progress.completed_exercise_ids_json == ["ex-choose"]


async def test_complete_exercise_given_concurrent_ids_expect_both_preserved(
    setup_database: None,
) -> None:
    token = uuid4().hex
    seed_session = _lesson_independent_session()
    tasks: list[asyncio.Task[None]] = []
    release_first = asyncio.Event()
    seed_ids: tuple[int, int, int] | None = None
    try:
        user = User(email=f"lesson-race-{token}@example.com", display_name="Tester")
        release = LessonRelease(
            source=f"test-{token}",
            digest=f"digest-{token}",
            schema_version="4.0",
            language="nb-NO",
            translation_language="en",
            lesson_count=1,
            is_active=True,
        )
        seed_session.add_all([user, release])
        await seed_session.flush()

        lesson = Lesson(
            release_id=release.id,
            source_id=f"lesson-{token}",
            release_order=1,
            kind="grammar",
            title="Concurrency",
            cefr_level="A1",
            goal="Practice.",
            packet_json={
                "exercises": [{"id": "ex-a"}, {"id": "ex-b"}],
            },
        )
        seed_session.add(lesson)
        await seed_session.flush()
        progress = UserLessonProgress(
            user_id=user.id,
            lesson_id=lesson.id,
            completed_exercise_ids_json=[],
        )
        seed_session.add(progress)
        await seed_session.commit()
        seed_ids = (user.id, lesson.id, release.id)

        first_loaded = asyncio.Event()
        second_started = asyncio.Event()
        tasks.append(
            asyncio.create_task(
                _complete_exercise_and_commit(
                    user_id=user.id,
                    lesson_id=lesson.id,
                    exercise_id="ex-a",
                    progress_loaded=first_loaded,
                    release_progress=release_first,
                )
            )
        )
        await asyncio.wait_for(first_loaded.wait(), timeout=2)

        tasks.append(
            asyncio.create_task(
                _complete_exercise_and_commit(
                    user_id=user.id,
                    lesson_id=lesson.id,
                    exercise_id="ex-b",
                    progress_query_started=second_started,
                )
            )
        )
        await asyncio.wait_for(second_started.wait(), timeout=2)
        release_first.set()
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=4)

        async with _lesson_independent_session() as verify_session:
            saved = await verify_session.scalar(
                select(UserLessonProgress).where(
                    UserLessonProgress.user_id == user.id,
                    UserLessonProgress.lesson_id == lesson.id,
                )
            )
            assert saved is not None
            assert set(saved.completed_exercise_ids_json) == {"ex-a", "ex-b"}
    finally:
        release_first.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        await seed_session.close()
    if seed_ids is None:
        return
    user_id, lesson_id, release_id = seed_ids
    async with _lesson_independent_session() as cleanup_session:
        await cleanup_session.execute(
            delete(UserLessonProgress).where(UserLessonProgress.user_id == user_id)
        )
        await cleanup_session.execute(delete(Lesson).where(Lesson.id == lesson_id))
        await cleanup_session.execute(
            delete(LessonRelease).where(LessonRelease.id == release_id)
        )
        await cleanup_session.execute(delete(User).where(User.id == user_id))
        await cleanup_session.commit()


async def test_complete_exercise_given_unknown_exercise_expect_not_found(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))
    service = LessonService(db)
    await service.start_lesson(user.id, lesson.id)

    with pytest.raises(ExerciseNotFoundError):
        await service.complete_exercise(user.id, lesson.id, "ghost")


async def test_complete_exercise_given_no_start_expect_not_started(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))

    with pytest.raises(LessonNotStartedError):
        await LessonService(db).complete_exercise(user.id, lesson.id, "ex-choose")


async def test_complete_lesson_given_missing_exercises_expect_not_complete(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["lesson-a"])
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))
    service = LessonService(db)
    await service.start_lesson(user.id, lesson.id)

    with pytest.raises(LessonNotCompleteError):
        await service.complete_lesson(user.id, lesson.id)

    await service.complete_exercise(user.id, lesson.id, "ex-choose")
    await service.complete_exercise(user.id, lesson.id, "ex-speak")
    await service.complete_lesson(user.id, lesson.id)

    progress = await db.scalar(select(UserLessonProgress))
    assert progress.completed_at is not None

    await service.complete_lesson(user.id, lesson.id)


async def test_list_lessons_given_active_release_expect_flat_order(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(db, tmp_path, lesson_ids=["zzz", "aaa"])
    user = await UserFactory.create()

    summaries = await LessonService(db).list_lessons(user.id)

    assert [summary.source_id for summary in summaries] == ["zzz", "aaa"]
    assert summaries[0].state == "not_started"


async def test_get_lesson_detail_given_synthesized_audio_expect_url(
    db: AsyncSession, tmp_path: Path
) -> None:
    await import_lesson_import_dir(
        db, tmp_path, lesson_ids=["lesson-a"], with_audio=True
    )
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))

    detail = await LessonService(db).get_lesson_detail(user.id, lesson.id)

    assert detail.packet["id"] == "lesson-a"
    by_id = {asset.id: asset for asset in detail.media.audio}
    assert by_id["audio-model"].url == (
        "https://media.example.test/audio/lessons/lesson-a/"
        "00000000-0000-4000-8000-000000000001.wav"
    )
    assert by_id["audio-model"].path == (
        "audio/lessons/lesson-a/00000000-0000-4000-8000-000000000001.wav"
    )
    assert detail.progress is None


async def test_get_lesson_detail_given_write_exercise_expect_judge_prompt_omitted(
    db: AsyncSession, tmp_path: Path
) -> None:
    root = build_import_dir(
        tmp_path,
        lesson_ids=["lesson-a"],
        exercises=[exercise_for("write")],
    )
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    user = await UserFactory.create()
    lesson = await db.scalar(select(Lesson))

    detail = await LessonService(db).get_lesson_detail(user.id, lesson.id)

    write_payload = detail.packet["exercises"][0]["payload"]
    assert "judge_prompt" not in write_payload
    assert write_payload["criteria"] == [{"id": "c1", "instruction": "Bruker presens."}]
    stored_write = lesson.packet_json["exercises"][0]["payload"]
    assert stored_write["judge_prompt"] == "Judge the paragraph."


class StubJudgeProvider(ModelProvider):
    """Minimal provider stand-in recording the judge request."""

    def __init__(self, text: str | None = None, failure: Exception | None = None):
        self.text = text
        self.failure = failure
        self.requests: list[GenerationRequest] = []

    @property
    def name(self) -> str:
        return "stub"

    @property
    def model(self) -> str:
        return "flyt/stub"

    @property
    def limited_by_flyt(self) -> bool:
        return True

    async def is_available(self, user_id: int) -> ProviderAvailability:
        return ProviderAvailability(available=True)

    async def generate(self, user_id: int, request: GenerationRequest):
        self.requests.append(request)
        if self.failure is not None:
            raise self.failure
        return GenerationResult(text=self.text)


async def import_write_lesson(db: AsyncSession, tmp_path: Path):
    root = build_import_dir(
        tmp_path, lesson_ids=["lesson-a"], exercises=[exercise_for("write")]
    )
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    return lesson


async def test_evaluate_write_exercise_given_valid_response_expect_verdicts(
    db: AsyncSession, tmp_path: Path
) -> None:
    lesson = await import_write_lesson(db, tmp_path)
    user = await UserFactory.create()
    provider = StubJudgeProvider(
        text='{"criteria": [{"criterion_id": "c1", "met": true, "evidence": "skriver"}]}'
    )

    judgement = await LessonService(db).evaluate_write_exercise(
        user.id,
        lesson.id,
        "ex-write",
        "Jeg skriver en kort tekst nå.",
        provider=provider,
    )

    assert [verdict.criterion_id for verdict in judgement.criteria] == ["c1"]
    assert judgement.criteria[0].met is True
    assert judgement.criteria[0].evidence == "skriver"
    assert "Judge the paragraph." in provider.requests[0].instructions
    assert "Jeg skriver en kort tekst nå." in provider.requests[0].prompt
    assert "- c1: Bruker presens." in provider.requests[0].prompt


async def test_evaluate_write_exercise_given_unknown_exercise_expect_no_provider_call(
    db: AsyncSession, tmp_path: Path
) -> None:
    lesson = await import_write_lesson(db, tmp_path)
    user = await UserFactory.create()
    provider = StubJudgeProvider(text="{}")

    with pytest.raises(ExerciseNotFoundError):
        await LessonService(db).evaluate_write_exercise(
            user.id, lesson.id, "ghost", "Jeg skriver nå.", provider=provider
        )

    assert provider.requests == []


async def test_evaluate_write_exercise_given_non_write_exercise_expect_no_provider_call(
    db: AsyncSession, tmp_path: Path
) -> None:
    root = build_import_dir(
        tmp_path, lesson_ids=["lesson-a"], exercises=[exercise_for("choose")]
    )
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    lesson = await db.scalar(select(Lesson))
    user = await UserFactory.create()
    provider = StubJudgeProvider(text="{}")

    with pytest.raises(ExerciseNotFoundError):
        await LessonService(db).evaluate_write_exercise(
            user.id, lesson.id, "ex-choose", "Jeg velger nå.", provider=provider
        )

    assert provider.requests == []


async def test_evaluate_write_exercise_given_below_minimum_expect_invalid(
    db: AsyncSession, tmp_path: Path
) -> None:
    lesson = await import_write_lesson(db, tmp_path)
    user = await UserFactory.create()
    provider = StubJudgeProvider(text="{}")

    with pytest.raises(ExerciseResponseInvalidError, match="at least 5 words"):
        await LessonService(db).evaluate_write_exercise(
            user.id, lesson.id, "ex-write", "For kort.", provider=provider
        )

    assert provider.requests == []


async def test_evaluate_write_exercise_given_provider_failure_expect_unavailable(
    db: AsyncSession, tmp_path: Path
) -> None:
    lesson = await import_write_lesson(db, tmp_path)
    user = await UserFactory.create()
    provider = StubJudgeProvider(
        failure=ProviderFailure(ProviderFailureClass.TIMEOUT, "timed out")
    )

    with pytest.raises(ExerciseEvaluationUnavailableError):
        await LessonService(db).evaluate_write_exercise(
            user.id,
            lesson.id,
            "ex-write",
            "Jeg skriver en kort tekst nå.",
            provider=provider,
        )


async def test_evaluate_write_exercise_given_malformed_output_expect_unavailable(
    db: AsyncSession, tmp_path: Path
) -> None:
    lesson = await import_write_lesson(db, tmp_path)
    user = await UserFactory.create()
    provider = StubJudgeProvider(text="The response looks great!")

    with pytest.raises(ExerciseEvaluationUnavailableError):
        await LessonService(db).evaluate_write_exercise(
            user.id,
            lesson.id,
            "ex-write",
            "Jeg skriver en kort tekst nå.",
            provider=provider,
        )


def test_lesson_evaluation_service_given_settings_expect_configured_model() -> None:
    from flyt.apps.lessons.deps import build_lesson_evaluation_service

    evaluation_service = build_lesson_evaluation_service()

    assert evaluation_service.provider.model == (
        settings.LESSON_WRITE_JUDGE_OPENROUTER_MODEL
    )
    assert (
        evaluation_service.provider.model != settings.STORY_GENERATION_OPENROUTER_MODEL
    )


class LessonProgressBarrierSession:
    def __init__(
        self,
        delegate: AsyncSession,
        *,
        progress_query_started: asyncio.Event | None = None,
        progress_loaded: asyncio.Event | None = None,
        release_progress: asyncio.Event | None = None,
    ) -> None:
        self._delegate = delegate
        self._progress_query_started = progress_query_started
        self._progress_loaded = progress_loaded
        self._release_progress = release_progress

    async def scalar(self, statement: Any) -> Any:
        if self._progress_query_started and self._is_progress_query(statement):
            self._progress_query_started.set()

        result = await self._delegate.scalar(statement)
        if isinstance(result, UserLessonProgress) and self._progress_loaded:
            self._progress_loaded.set()
            if self._release_progress:
                await asyncio.wait_for(self._release_progress.wait(), timeout=2)
        return result

    def __getattr__(self, name: str) -> Any:
        return getattr(self._delegate, name)

    @staticmethod
    def _is_progress_query(statement: Any) -> bool:
        return any(
            description.get("entity") is UserLessonProgress
            for description in statement.column_descriptions
        )


def _lesson_independent_session() -> AsyncSession:
    from tests.conftest import async_engine

    return AsyncSession(bind=async_engine, expire_on_commit=False)


async def _complete_exercise_and_commit(
    *,
    user_id: int,
    lesson_id: int,
    exercise_id: str,
    progress_query_started: asyncio.Event | None = None,
    progress_loaded: asyncio.Event | None = None,
    release_progress: asyncio.Event | None = None,
) -> None:
    session = _lesson_independent_session()
    try:
        service = LessonService(
            cast(
                AsyncSession,
                LessonProgressBarrierSession(
                    session,
                    progress_query_started=progress_query_started,
                    progress_loaded=progress_loaded,
                    release_progress=release_progress,
                ),
            )
        )
        await service.complete_exercise(user_id, lesson_id, exercise_id)
        await session.commit()
    finally:
        await session.close()
