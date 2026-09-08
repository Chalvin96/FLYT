"""Unit tests for the E2E seed module (flyt.apps.test_support.seed).

These functions are only reachable in the E2E environment but each helper is
a pure DB operation that can be exercised directly against the test savepoint.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.test_support import seed
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserSettings
from flyt.core.config import settings
from tests.factories import CardPoolFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import LessonFactory
from tests.factories import UserFactory

pytestmark = pytest.mark.anyio


# ── assert_e2e_environment ──────────────────────────────────────────────────


async def test_assert_e2e_environment_given_wrong_env_expect_runtime_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", "test")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://flyt_e2e")

    with pytest.raises(RuntimeError, match="ENV=e2e"):
        seed.assert_e2e_environment()


async def test_assert_e2e_environment_given_wrong_database_url_expect_runtime_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", "e2e")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://wrong_db")

    with pytest.raises(RuntimeError, match="flyt_e2e"):
        seed.assert_e2e_environment()


async def test_assert_e2e_environment_given_correct_environment_expect_pass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", "e2e")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql://flyt_e2e")

    # No exception raised.
    seed.assert_e2e_environment()


# ── create_e2e_user ─────────────────────────────────────────────────────────


async def test_create_e2e_user_given_email_expect_user_settings_and_identity(
    async_session: AsyncSession,
) -> None:
    user = await seed.create_e2e_user(async_session, "test-e2e@example.com")

    assert user.id is not None
    assert user.email == "test-e2e@example.com"
    assert user.display_name == "test-e2e"
    assert user.last_login is not None

    user_settings = await async_session.scalar(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    assert user_settings is not None

    identity = await async_session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.user_id == user.id,
            AuthIdentity.provider == "e2e",
        )
    )
    assert identity is not None
    assert identity.provider_subject == "test-e2e@example.com"


# ── reset_e2e_users ─────────────────────────────────────────────────────────


async def test_reset_e2e_users_given_no_matching_users_expect_noop(
    async_session: AsyncSession,
) -> None:
    # No E2E_EMAILS user exists; reset should be a no-op without raising.
    await seed.reset_e2e_users(async_session)


async def test_reset_e2e_users_given_existing_users_expect_deleted(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create(email=seed.E2E_EMAILS[0])
    await seed.reset_e2e_users(async_session)

    deleted = await async_session.scalar(select(User).where(User.id == user.id))
    assert deleted is None


# ── seed_lesson_progress ────────────────────────────────────────────────────


async def test_seed_lesson_progress_given_user_and_lesson_expect_row_created(
    async_session: AsyncSession,
) -> None:
    from flyt.apps.lessons.models import UserLessonProgress

    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    await seed.seed_lesson_progress(async_session, user, lesson)

    progress = await async_session.scalar(
        select(UserLessonProgress).where(
            UserLessonProgress.user_id == user.id,
            UserLessonProgress.lesson_id == lesson.id,
        )
    )
    assert progress is not None
    assert progress.completed_exercise_ids_json == []
    assert progress.completed_at is None


# ── seed_due_queue_entry ────────────────────────────────────────────────────


async def test_seed_due_queue_entry_given_pool_and_card_expect_user_card_created(
    async_session: AsyncSession,
) -> None:
    from datetime import timedelta

    from flyt.apps.flashcards.models import CardState
    from flyt.apps.flashcards.models import UserCard
    from flyt.libs.utils.date import now

    user = await UserFactory.create()
    pool = await CardPoolFactory.create()
    card = await FlashCardFactory.create(pool=pool, is_addable=True)
    due_at = now() - timedelta(minutes=5)

    await seed.seed_due_queue_entry(async_session, user, pool, card, due_at)

    user_card = await async_session.scalar(
        select(UserCard).where(
            UserCard.user_id == user.id,
            UserCard.pool_id == pool.id,
        )
    )
    assert user_card is not None
    assert user_card.state == CardState.NEW
    assert user_card.last_shown_card_id == card.id


# ── select_seed_lesson ──────────────────────────────────────────────────────


async def test_select_seed_lesson_given_known_key_lesson_expect_returned(
    async_session: AsyncSession,
) -> None:
    lesson = await LessonFactory.create(source_id=seed.LEARNER_LESSON_KEY)

    result = await seed.select_seed_lesson(async_session)

    assert result.id == lesson.id


async def test_select_seed_lesson_given_fallback_with_two_pools_expect_returned(
    async_session: AsyncSession,
) -> None:
    # No lesson with the well-known key exists; the fallback should pick a
    # lesson with at least two review pools.
    lesson = await LessonFactory.create()
    await CardPoolFactory.create(lesson=lesson)
    await CardPoolFactory.create(lesson=lesson)

    result = await seed.select_seed_lesson(async_session)

    assert result.id == lesson.id


# ── seed_due_cards ──────────────────────────────────────────────────────────


async def test_seed_due_cards_given_insufficient_pools_expect_runtime_error(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    with pytest.raises(RuntimeError, match="distinct imported lesson card pools"):
        await seed.seed_due_cards(async_session, user, count=1)


async def test_seed_due_cards_given_sufficient_pools_expect_cards_created(
    async_session: AsyncSession,
) -> None:
    from flyt.apps.flashcards.models import UserCard

    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    pool = await CardPoolFactory.create(lesson=lesson)
    await FlashCardFactory.create(pool=pool, is_addable=True)

    await seed.seed_due_cards(async_session, user, count=1)

    user_card = await async_session.scalar(
        select(UserCard).where(
            UserCard.user_id == user.id,
            UserCard.pool_id == pool.id,
        )
    )
    assert user_card is not None


# ── seed_definition_due_cards ───────────────────────────────────────────────


async def test_seed_definition_due_cards_given_insufficient_pools_expect_error(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()

    with pytest.raises(RuntimeError):
        await seed.seed_definition_due_cards(async_session, user, count=1)


async def test_seed_definition_due_cards_given_pool_without_card_expect_error(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    pool = await CardPoolFactory.create(lesson=lesson)
    # Non-DEFINITION card type — does not satisfy the DEFINITION requirement.
    from flyt.apps.flashcards.models import CardType

    await FlashCardFactory.create(
        pool=pool,
        is_addable=True,
        type=CardType.CHOOSE,
        schema_version="4.0",
        payload_json={
            "kind": "exercise",
            "id": "ex-1",
            "operation": "choose",
            "prompt": [],
            "explanation": None,
            "payload": {
                "options": [{"option_id": "a", "text": "ja"}],
                "answer_id": "a",
            },
        },
    )

    with pytest.raises(RuntimeError):
        await seed.seed_definition_due_cards(async_session, user, count=1)


# ── ensure_definition_card_pools ────────────────────────────────────────────


async def test_ensure_definition_card_pools_given_existing_pools_expect_noop(
    async_session: AsyncSession,
) -> None:
    from flyt.apps.flashcards.models import CardType

    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    await FlashCardFactory.create(pool=pool, is_addable=True, type=CardType.DEFINITION)

    # Already has 1 definition pool; requesting count=1 should be a no-op.
    await seed.ensure_definition_card_pools(async_session, count=1)


async def test_ensure_definition_card_pools_given_lemma_with_source_lemma_id_expect_correct_key(
    async_session: AsyncSession,
) -> None:
    from sqlalchemy import select as sa_select

    from flyt.apps.flashcards.models import CardPool

    lemma = await LemmaFactory.create(source_lemma_id=42, source_article_id=1)
    lemma.definitions = []

    await seed.ensure_definition_card_pools(async_session, count=1)

    pool = await async_session.scalar(
        sa_select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is not None
    # Keyed on (source_article_id, source_lemma_id), not the old
    # source_lemma_id-only form.
    assert pool.key == "vocab_source_1_42"


async def test_ensure_definition_card_pools_given_lemma_with_only_article_id_expect_correct_key(
    async_session: AsyncSession,
) -> None:
    from sqlalchemy import select as sa_select

    from flyt.apps.flashcards.models import CardPool

    lemma = await LemmaFactory.create(source_lemma_id=None, source_article_id=99)
    lemma.definitions = []

    await seed.ensure_definition_card_pools(async_session, count=1)

    pool = await async_session.scalar(
        sa_select(CardPool).where(CardPool.lemma_id == lemma.id)
    )
    assert pool is not None
    assert "vocab_source_article_99" in pool.key


async def test_ensure_definition_card_pools_given_insufficient_lemmas_expect_error(
    async_session: AsyncSession,
) -> None:
    with pytest.raises(RuntimeError, match="imported lemmas"):
        await seed.ensure_definition_card_pools(async_session, count=5)


# ── seed_definition_due_cards success path ───────────────────────────────────


async def test_seed_definition_due_cards_given_definition_pool_expect_card_created(
    async_session: AsyncSession,
) -> None:
    from flyt.apps.flashcards.models import CardType
    from flyt.apps.flashcards.models import UserCard

    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma)
    await FlashCardFactory.create(pool=pool, is_addable=True, type=CardType.DEFINITION)

    await seed.seed_definition_due_cards(async_session, user, count=1)

    user_card = await async_session.scalar(
        select(UserCard).where(
            UserCard.user_id == user.id,
            UserCard.pool_id == pool.id,
        )
    )
    assert user_card is not None


# ── seed_due_cards pool without card error ───────────────────────────────────


async def test_seed_due_cards_given_pool_without_addable_card_expect_error(
    async_session: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lesson = await LessonFactory.create()
    pool = await CardPoolFactory.create(lesson=lesson)
    # Non-addable card — does not satisfy the addable requirement.
    await FlashCardFactory.create(pool=pool, is_addable=False)

    with pytest.raises(RuntimeError, match="without cards"):
        await seed.seed_due_cards(async_session, user, count=1)
