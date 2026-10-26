"""Seed a large, deterministic reading dataset into an isolated database."""

import argparse
import asyncio
from dataclasses import dataclass
from datetime import UTC
from datetime import datetime
from datetime import timedelta
import hashlib
import os
import random
from uuid import UUID

from sqlalchemy import insert
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.reading.queries import K_DEFAULT_HERO_GROUP_KEY
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserLemmaContext

K_READING_SEED_RANDOM_SEED = 645
K_READING_SEED_LEARNER_EMAIL = "reading-seed-learner@example.com"
K_READING_SEED_DATABASE_PREFIX = "reading_seed"
K_READING_SEED_PRESET_ENV = "READING_SEED_PRESET"
K_READING_SEED_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)
K_LOCAL_DATABASE_HOSTS = frozenset({"localhost", "127.0.0.1"})
K_CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
K_FAILED_IMPORT_EVERY = 10
K_PENDING_IMPORT_EVERY = 25
K_INSERT_CHUNK_ROWS = 2_000
K_MASTERED_SHARE = 0.5
K_COMPLETED_SHARE = 0.5
K_TIMESTAMP_SPREAD_MINUTES = 400_000


@dataclass(frozen=True)
class ReadingSeedSize:
    theme_count: int
    stories_per_theme: int
    pages_per_story: int
    tokens_per_page: int
    lemma_count: int
    known_lemma_count: int
    lookup_count: int
    read_story_count: int
    import_count: int
    other_learner_count: int
    other_learner_known_lemma_count: int
    other_learner_read_story_count: int


@dataclass(frozen=True)
class ReadingSeed:
    learner: User
    theme_key: str
    read_story_uuid: UUID


K_READING_SEED_PRESETS = {
    "small": ReadingSeedSize(
        theme_count=3,
        stories_per_theme=8,
        pages_per_story=2,
        tokens_per_page=20,
        lemma_count=200,
        known_lemma_count=120,
        lookup_count=50,
        read_story_count=10,
        import_count=6,
        other_learner_count=2,
        other_learner_known_lemma_count=20,
        other_learner_read_story_count=3,
    ),
    "large": ReadingSeedSize(
        theme_count=12,
        stories_per_theme=250,
        pages_per_story=3,
        tokens_per_page=120,
        lemma_count=40_000,
        known_lemma_count=30_000,
        lookup_count=20_000,
        read_story_count=2_500,
        import_count=200,
        other_learner_count=50,
        other_learner_known_lemma_count=2_000,
        other_learner_read_story_count=100,
    ),
}


def is_isolated_database_url(database_url: str) -> bool:
    url = make_url(database_url)
    host = (url.host or "").lower()
    database = (url.database or "").lower()
    return (
        "?" not in database_url
        and host in K_LOCAL_DATABASE_HOSTS
        and database.startswith(K_READING_SEED_DATABASE_PREFIX)
    )


def build_reading_endpoint_paths(seed: ReadingSeed) -> dict[str, str]:
    story = seed.read_story_uuid
    return {
        "reading home": "/reading/home",
        "theme list": "/reading/groups",
        "theme stories": f"/reading/stories?group_key={seed.theme_key}",
        "story page": f"/reading/stories/{story}",
        "recommendations": f"/reading/stories/{story}/recommendations",
        "imports": "/imports",
    }


async def seed_reading_scale(db: AsyncSession, size: ReadingSeedSize) -> ReadingSeed:
    rng = random.Random(K_READING_SEED_RANDOM_SEED)
    learner = User(
        uuid=_generate_uuid(rng),
        email=K_READING_SEED_LEARNER_EMAIL,
        display_name="Reading seed learner",
    )
    db.add(learner)
    await db.flush()

    lemma_ids, lemma_uuids = await _insert_lemmas(db, rng, size)
    await _insert_known_lemmas(db, rng, learner.id, lemma_ids, size.known_lemma_count)
    await _insert_lookups(db, rng, learner.id, lemma_ids, size)
    theme_keys, story_ids, story_uuids = await _insert_public_stories(
        db, rng, lemma_uuids, size
    )
    read_positions = await _insert_read_history(
        db, rng, learner.id, story_ids, size.read_story_count, size
    )
    await _insert_imports(db, rng, learner.id, lemma_uuids, size)
    await _insert_other_learners(db, rng, lemma_ids, story_ids, size)
    return ReadingSeed(
        learner=learner,
        theme_key=theme_keys[0],
        read_story_uuid=story_uuids[read_positions[0]],
    )


async def load_reading_seed(db: AsyncSession) -> ReadingSeed:
    learner = await db.scalar(
        select(User).where(User.email == K_READING_SEED_LEARNER_EMAIL)
    )
    if learner is None:
        msg = "No reading seed found; run scripts/seed_reading_scale.py first"
        raise RuntimeError(msg)
    theme_key = await db.scalar(
        select(ReadingGroup.key).order_by(ReadingGroup.order).limit(1)
    )
    read_story_uuid = await db.scalar(
        select(Story.uuid)
        .join(UserStory, UserStory.story_id == Story.id)
        .where(
            UserStory.user_id == learner.id,
            Story.visibility == StoryVisibility.PUBLIC,
        )
        .order_by(UserStory.id)
        .limit(1)
    )
    if theme_key is None or read_story_uuid is None:
        msg = "Reading seed is incomplete"
        raise RuntimeError(msg)
    return ReadingSeed(
        learner=learner, theme_key=theme_key, read_story_uuid=read_story_uuid
    )


def _generate_uuid(rng: random.Random) -> UUID:
    return UUID(int=rng.getrandbits(128), version=4)


def _generate_timestamp(rng: random.Random) -> datetime:
    offset = timedelta(minutes=rng.randrange(K_TIMESTAMP_SPREAD_MINUTES))
    return (K_READING_SEED_EPOCH + offset).replace(tzinfo=None)


async def _insert_returning_ids(db: AsyncSession, model, rows: list[dict]) -> list:
    ids: list = []
    for start in range(0, len(rows), K_INSERT_CHUNK_ROWS):
        chunk = rows[start : start + K_INSERT_CHUNK_ROWS]
        result = await db.execute(
            insert(model).returning(model.id, sort_by_parameter_order=True), chunk
        )
        ids.extend(result.scalars().all())
    return ids


async def _insert_rows(db: AsyncSession, model, rows: list[dict]) -> None:
    for start in range(0, len(rows), K_INSERT_CHUNK_ROWS):
        await db.execute(insert(model), rows[start : start + K_INSERT_CHUNK_ROWS])


async def _insert_lemmas(
    db: AsyncSession, rng: random.Random, size: ReadingSeedSize
) -> tuple[list[int], list[UUID]]:
    lemma_uuids = [_generate_uuid(rng) for _ in range(size.lemma_count)]
    rows = [
        {
            "uuid": lemma_uuid,
            "word": f"ord{index:05d}",
            "pos": LemmaPos.NOUN,
            "hgno": 1,
            "is_sub_article": False,
            "primary_translation": f"word {index}",
            "frequency_rank": index + 1,
        }
        for index, lemma_uuid in enumerate(lemma_uuids)
    ]
    lemma_ids = await _insert_returning_ids(db, Lemma, rows)
    return lemma_ids, lemma_uuids


async def _insert_known_lemmas(
    db: AsyncSession,
    rng: random.Random,
    learner_id: int,
    lemma_ids: list[int],
    known_lemma_count: int,
) -> None:
    known_ids = rng.sample(lemma_ids, known_lemma_count)
    rows = [
        {
            "user_id": learner_id,
            "lemma_id": lemma_id,
            "is_mastered": rng.random() < K_MASTERED_SHARE,
            "created_at": _generate_timestamp(rng),
        }
        for lemma_id in known_ids
    ]
    await _insert_rows(db, UserLemma, rows)


async def _insert_lookups(
    db: AsyncSession,
    rng: random.Random,
    learner_id: int,
    lemma_ids: list[int],
    size: ReadingSeedSize,
) -> None:
    rows = [
        {
            "user_id": learner_id,
            "lemma_id": rng.choice(lemma_ids),
            "source_sentence": f"Seed lookup sentence {index}.",
            "source_title": f"Seed story {index % 97}",
            "created_at": _generate_timestamp(rng),
        }
        for index in range(size.lookup_count)
    ]
    await _insert_rows(db, UserLemmaContext, rows)


async def _insert_public_stories(
    db: AsyncSession,
    rng: random.Random,
    lemma_uuids: list[UUID],
    size: ReadingSeedSize,
) -> tuple[list[str], list[int], list[UUID]]:
    theme_keys = [K_DEFAULT_HERO_GROUP_KEY] + [
        f"seed_theme_{index:02d}" for index in range(1, size.theme_count)
    ]
    group_ids = await _insert_returning_ids(
        db,
        ReadingGroup,
        [
            {"key": key, "title": f"Seed theme {index}", "order": index}
            for index, key in enumerate(theme_keys)
        ],
    )
    story_rows: list[dict] = []
    for group_id in group_ids:
        for _ in range(size.stories_per_theme):
            story_number = len(story_rows)
            story_rows.append(
                {
                    "uuid": _generate_uuid(rng),
                    "title": f"Seed story {story_number}",
                    "content": f"Seed story {story_number}.",
                    "cefr_level": rng.choice(K_CEFR_LEVELS),
                    "slug": f"seed-story-{story_number}",
                    "visibility": StoryVisibility.PUBLIC,
                    "is_ready": True,
                    "word_count": size.pages_per_story * size.tokens_per_page,
                    "reading_group_id": group_id,
                    "created_at": _generate_timestamp(rng),
                }
            )
    story_ids = await _insert_returning_ids(db, Story, story_rows)
    await _insert_pages(db, rng, story_ids, lemma_uuids, size)
    return theme_keys, story_ids, [row["uuid"] for row in story_rows]


async def _insert_pages(
    db: AsyncSession,
    rng: random.Random,
    story_ids: list[int],
    lemma_uuids: list[UUID],
    size: ReadingSeedSize,
) -> None:
    rows = [
        _build_page_row(rng, story_id, page_index, lemma_uuids, size)
        for story_id in story_ids
        for page_index in range(size.pages_per_story)
    ]
    await _insert_rows(db, StoryPage, rows)


def _build_page_row(
    rng: random.Random,
    story_id: int,
    page_index: int,
    lemma_uuids: list[UUID],
    size: ReadingSeedSize,
) -> dict:
    words: list[str] = []
    tokens: list[dict] = []
    offset = 0
    for _ in range(size.tokens_per_page):
        lemma_index = rng.randrange(len(lemma_uuids))
        word = f"ord{lemma_index:05d}"
        tokens.append(
            {
                "word": word,
                "start": offset,
                "end": offset + len(word),
                "lemmaUuid": str(lemma_uuids[lemma_index]),
            }
        )
        words.append(word)
        offset += len(word) + 1
    return {
        "story_id": story_id,
        "index": page_index,
        "content": " ".join(words),
        "text_annotations_json": tokens,
        "word_count": size.tokens_per_page,
    }


async def _insert_read_history(
    db: AsyncSession,
    rng: random.Random,
    learner_id: int,
    story_ids: list[int],
    read_story_count: int,
    size: ReadingSeedSize,
) -> list[int]:
    read_positions = rng.sample(range(len(story_ids)), read_story_count)
    rows = [
        {
            "uuid": _generate_uuid(rng),
            "user_id": learner_id,
            "story_id": story_ids[position],
            "last_page_index": rng.randrange(size.pages_per_story),
            "completed": rng.random() < K_COMPLETED_SHARE,
            "created_at": _generate_timestamp(rng),
        }
        for position in read_positions
    ]
    await _insert_rows(db, UserStory, rows)
    return read_positions


async def _insert_other_learners(
    db: AsyncSession,
    rng: random.Random,
    lemma_ids: list[int],
    story_ids: list[int],
    size: ReadingSeedSize,
) -> None:
    learner_ids = await _insert_returning_ids(
        db,
        User,
        [
            {
                "uuid": _generate_uuid(rng),
                "email": f"reading-seed-other-{index}@example.com",
                "display_name": f"Reading seed other learner {index}",
            }
            for index in range(size.other_learner_count)
        ],
    )
    for learner_id in learner_ids:
        await _insert_known_lemmas(
            db, rng, learner_id, lemma_ids, size.other_learner_known_lemma_count
        )
        await _insert_read_history(
            db, rng, learner_id, story_ids, size.other_learner_read_story_count, size
        )


async def _insert_imports(
    db: AsyncSession,
    rng: random.Random,
    learner_id: int,
    lemma_uuids: list[UUID],
    size: ReadingSeedSize,
) -> None:
    story_rows = [
        {
            "uuid": _generate_uuid(rng),
            "title": f"Seed import {index}",
            "content": f"Seed import {index}.",
            "visibility": StoryVisibility.PRIVATE,
            "is_ready": True,
            "word_count": size.pages_per_story * size.tokens_per_page,
            "created_at": _generate_timestamp(rng),
        }
        for index in range(size.import_count)
    ]
    story_ids = await _insert_returning_ids(db, Story, story_rows)
    statuses = [_select_import_status(index) for index in range(size.import_count)]
    await _insert_rows(
        db,
        ImportMeta,
        [
            {
                "story_id": story_id,
                "content_hash": hashlib.sha256(f"import-{index}".encode()).hexdigest(),
                "status": status,
            }
            for index, (story_id, status) in enumerate(
                zip(story_ids, statuses, strict=True)
            )
        ],
    )
    await _insert_rows(
        db,
        UserStory,
        [
            {
                "uuid": _generate_uuid(rng),
                "user_id": learner_id,
                "story_id": story_id,
                "title": f"Seed import {index}",
                "source_url": f"https://example.com/seed/{index}",
                "created_at": _generate_timestamp(rng),
            }
            for index, story_id in enumerate(story_ids)
        ],
    )
    ready_story_ids = [
        story_id
        for story_id, status in zip(story_ids, statuses, strict=True)
        if status is ImportStatus.READY
    ]
    await _insert_pages(db, rng, ready_story_ids, lemma_uuids, size)
    await db.flush()


def _select_import_status(index: int) -> ImportStatus:
    if index % K_FAILED_IMPORT_EVERY == K_FAILED_IMPORT_EVERY - 1:
        return ImportStatus.FAILED
    if index % K_PENDING_IMPORT_EVERY == K_PENDING_IMPORT_EVERY - 1:
        return ImportStatus.PENDING
    return ImportStatus.READY


async def _main(preset: str) -> None:
    from flyt.core.config import settings
    from flyt.core.db import AsyncSessionLocal

    if not is_isolated_database_url(settings.DATABASE_URL):
        msg = (
            "Refusing to seed: DATABASE_URL must be a local database named "
            f"{K_READING_SEED_DATABASE_PREFIX}*"
        )
        raise SystemExit(msg)
    async with AsyncSessionLocal() as db:
        await seed_reading_scale(db, K_READING_SEED_PRESETS[preset])
        await db.commit()
    print(f"Reading seed '{preset}' written.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--preset",
        choices=sorted(K_READING_SEED_PRESETS),
        default=os.environ.get(K_READING_SEED_PRESET_ENV, "small"),
    )
    asyncio.run(_main(parser.parse_args().preset))
