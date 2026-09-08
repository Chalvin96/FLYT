from datetime import datetime
from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy import exists
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.flashcards.card_service import lemma_pool_key
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lexicons.models import Lemma
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserSettings
from flyt.core.config import settings
from flyt.libs.utils.date import now

E2E_EMAILS = [
    "new-user@example.com",
    "empty-review@example.com",
    "empty-words@example.com",
    "learner@example.com",
    "review-rating@example.com",
    "review-complete@example.com",
    "review-definition@example.com",
    "power-learner@example.com",
    "power-full@example.com",
    "importer@example.com",
    "extension@example.com",
    "extension-import@example.com",
]
LEARNER_LESSON_KEY = "cardinal_numbers"
E2E_LESSON_CARD_COUNT = 3
K_E2E_DEFINITION_CARD_COUNT = 2
K_MIN_REVIEW_POOL_COUNT = 2


def assert_e2e_environment() -> None:
    if settings.ENV != "e2e":
        msg = "E2E seed may only run with ENV=e2e"
        raise RuntimeError(msg)
    if "flyt_e2e" not in settings.DATABASE_URL:
        msg = "E2E seed expected DATABASE_URL to point at flyt_e2e"
        raise RuntimeError(msg)


async def seed_e2e_user_state(db: AsyncSession) -> None:
    assert_e2e_environment()
    await reset_e2e_users(db)

    await create_e2e_user(db, "new-user@example.com")
    await create_e2e_user(db, "empty-review@example.com")
    await create_e2e_user(db, "empty-words@example.com")
    learner = await create_e2e_user(db, "learner@example.com")
    review_rating = await create_e2e_user(db, "review-rating@example.com")
    review_complete = await create_e2e_user(db, "review-complete@example.com")
    review_definition = await create_e2e_user(db, "review-definition@example.com")
    power_learner = await create_e2e_user(db, "power-learner@example.com")
    power_full = await create_e2e_user(db, "power-full@example.com")

    await create_e2e_user(db, "importer@example.com")
    await create_e2e_user(db, "extension@example.com")
    await create_e2e_user(db, "extension-import@example.com")

    lesson = await select_seed_lesson(db)
    await seed_lesson_progress(db, learner, lesson)

    await seed_definition_due_cards(
        db, review_rating, count=K_E2E_DEFINITION_CARD_COUNT
    )
    await seed_definition_due_cards(
        db, review_complete, count=K_E2E_DEFINITION_CARD_COUNT
    )
    await seed_definition_due_cards(
        db, review_definition, count=K_E2E_DEFINITION_CARD_COUNT
    )
    await seed_due_cards(db, power_learner, count=E2E_LESSON_CARD_COUNT)
    await seed_due_cards(db, power_full, count=E2E_LESSON_CARD_COUNT)

    await db.commit()


async def reset_e2e_users(db: AsyncSession) -> None:
    user_ids = [
        row[0]
        for row in (
            await db.execute(select(User.id).where(User.email.in_(E2E_EMAILS)))
        ).all()
    ]
    if not user_ids:
        return

    await db.execute(delete(UserCard).where(UserCard.user_id.in_(user_ids)))
    await db.execute(
        delete(UserLessonProgress).where(UserLessonProgress.user_id.in_(user_ids))
    )
    await db.execute(delete(UserSettings).where(UserSettings.user_id.in_(user_ids)))
    await db.execute(delete(AuthIdentity).where(AuthIdentity.user_id.in_(user_ids)))
    await db.execute(delete(User).where(User.id.in_(user_ids)))
    await db.flush()


async def create_e2e_user(db: AsyncSession, email: str) -> User:
    user = User(
        email=email,
        display_name=email.split("@")[0],
        avatar_url=None,
        last_login=now(),
    )
    db.add(user)
    await db.flush()
    db.add(UserSettings(user_id=user.id))
    db.add(
        AuthIdentity(
            user_id=user.id,
            provider="e2e",
            provider_subject=email,
            email_at_link=email,
        )
    )
    await db.flush()
    return user


async def select_seed_lesson(db: AsyncSession) -> Lesson:
    lesson = await db.scalar(
        select(Lesson).where(Lesson.source_id == LEARNER_LESSON_KEY)
    )
    if lesson is not None:
        return lesson

    lesson = await db.scalar(
        select(Lesson)
        .join(CardPool, CardPool.lesson_id == Lesson.id)
        .group_by(Lesson.id)
        .having(func.count(func.distinct(CardPool.id)) >= K_MIN_REVIEW_POOL_COUNT)
        .order_by(
            Lesson.cefr_level.asc().nulls_last(),
            Lesson.release_order.asc(),
            Lesson.id.asc(),
        )
        .limit(1)
    )
    if lesson is None:
        msg = (
            "E2E seed requires imported lesson data with at least one lesson "
            "and two review pools"
        )
        raise RuntimeError(msg)
    return lesson


async def seed_lesson_progress(db: AsyncSession, user: User, lesson: Lesson) -> None:
    db.add(
        UserLessonProgress(
            user_id=user.id,
            lesson_id=lesson.id,
            completed_exercise_ids_json=[],
            completed_at=None,
        )
    )
    await db.flush()


async def seed_due_cards(db: AsyncSession, user: User, count: int) -> None:
    pools = (
        (
            await db.execute(
                select(CardPool)
                .where(CardPool.lesson_id.is_not(None))
                .order_by(CardPool.id.asc())
                .limit(count)
            )
        )
        .scalars()
        .all()
    )
    if len(pools) < count:
        msg = (
            f"E2E seed requires {count} distinct imported lesson card pools; "
            f"found {len(pools)}"
        )
        raise RuntimeError(msg)

    due_at = now() - timedelta(minutes=5)
    for pool in pools:
        card = await db.scalar(
            select(FlashCard)
            .where(FlashCard.pool_id == pool.id)
            .where(FlashCard.is_addable.is_(True))
            .order_by(FlashCard.id.asc())
            .limit(1)
        )
        if card is None:
            msg = f"E2E seed found card pool {pool.id} without cards"
            raise RuntimeError(msg)
        await seed_due_queue_entry(db, user, pool, card, due_at)


async def seed_definition_due_cards(db: AsyncSession, user: User, count: int) -> None:
    await ensure_definition_card_pools(db, count=count)

    rows = (
        await db.execute(
            select(CardPool, FlashCard)
            .join(FlashCard, FlashCard.pool_id == CardPool.id)
            .where(CardPool.lemma_id.is_not(None))
            .where(FlashCard.type == CardType.DEFINITION)
            .where(FlashCard.is_addable.is_(True))
            .order_by(CardPool.id.asc(), FlashCard.id.asc())
            .limit(count)
        )
    ).all()
    if len(rows) < count:
        msg = (
            f"E2E seed requires {count} imported definition card pools; "
            f"found {len(rows)}"
        )
        raise RuntimeError(msg)

    due_at = now() - timedelta(minutes=5)
    for pool, card in rows:
        await seed_due_queue_entry(db, user, pool, card, due_at)


async def seed_due_queue_entry(
    db: AsyncSession,
    user: User,
    pool: CardPool,
    card: FlashCard,
    due_at: datetime,
) -> None:
    user_card = UserCard(
        user_id=user.id,
        pool_id=pool.id,
        last_shown_card_id=card.id,
        state=CardState.NEW,
        due_at=due_at,
    )
    db.add(user_card)
    await db.flush()


async def ensure_definition_card_pools(db: AsyncSession, count: int) -> None:
    existing_count = await db.scalar(
        select(func.count(CardPool.id))
        .join(FlashCard, FlashCard.pool_id == CardPool.id)
        .where(CardPool.lemma_id.is_not(None))
        .where(FlashCard.type == CardType.DEFINITION)
        .where(FlashCard.is_addable.is_(True))
    )
    existing_count = existing_count or 0
    if existing_count >= count:
        return

    lemmas = (
        await db.scalars(
            select(Lemma)
            .options(selectinload(Lemma.definitions))
            .where(~exists(select(CardPool.id).where(CardPool.lemma_id == Lemma.id)))
            .order_by(Lemma.id.asc())
            .limit(count - existing_count)
        )
    ).all()
    if len(lemmas) < count - existing_count:
        msg = "E2E seed requires imported lemmas to create definition cards"
        raise RuntimeError(msg)

    for lemma in lemmas:
        pool = CardPool(
            lemma_id=lemma.id,
            lesson_id=None,
            key=lemma_pool_key(lemma),
        )
        db.add(pool)
        await db.flush()
        db.add(
            FlashCard(
                type=CardType.DEFINITION,
                pool_id=pool.id,
                is_addable=True,
                payload_json={
                    "lemma_uuid": str(lemma.uuid),
                    "source_article_id": lemma.source_article_id,
                    "source_lemma_id": lemma.source_lemma_id,
                    "hgno": lemma.hgno,
                    "is_sub_article": lemma.is_sub_article,
                    "word": lemma.word,
                    "pos": lemma.pos.value,
                    "primary_translation": lemma.primary_translation,
                    "ipa": lemma.ipa,
                    "intonation": lemma.intonation,
                    "ipa_approximate": lemma.ipa_approximate,
                    "audio_url": lemma.audio_url,
                    "definitions": [
                        {
                            "uuid": str(definition.uuid),
                            "definition": definition.definition,
                            "translation": definition.translation,
                            "examples_json": definition.examples_json,
                        }
                        for definition in lemma.definitions
                    ],
                },
            )
        )
        await db.flush()
