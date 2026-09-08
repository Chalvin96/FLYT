import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest
from sqlalchemy import delete as sa_delete
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.stats.queries import StatsQueryService
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.users.deletion import AccountDeletionService
from flyt.apps.users.models import User
from tests.conftest import async_engine

pytestmark = pytest.mark.anyio

K_FAIL_ON_RELEASE_CALL = 2
K_EXPECTED_SURVIVING_STORY_COUNT = 2

BLOCKED_AFTER = 0.5


@asynccontextmanager
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(bind=async_engine, expire_on_commit=False) as db:
        yield db


async def make_user(db: AsyncSession) -> User:
    user = User(email=f"{uuid4().hex}@example.com", display_name="Leaver")
    db.add(user)
    await db.flush()
    return user


async def make_import(db: AsyncSession, user_id: int, digest: str) -> int:
    story = Story(
        title="Imported",
        content="tekst",
        cefr_level=None,
        slug=None,
        reading_group_id=None,
        visibility=StoryVisibility.PRIVATE,
        is_ready=False,
        word_count=1,
    )
    db.add(story)
    await db.flush()
    db.add(
        ImportMeta(story_id=story.id, content_hash=digest, status=ImportStatus.PENDING)
    )
    db.add(
        UserStory(
            user_id=user_id,
            story_id=story.id,
            last_page_index=0,
            completed=False,
        )
    )
    await db.flush()
    return story.id


async def discard(user_id: int, story_ids: list[int]) -> None:
    async with session() as db:
        await db.execute(sa_delete(User).where(User.id == user_id))
        await db.execute(sa_delete(Story).where(Story.id.in_(story_ids)))
        await db.commit()


def deletion_service(db: AsyncSession) -> AccountDeletionService:
    return AccountDeletionService(db, stats=StatsQueryService(db))


async def delete_account_as_route(db: AsyncSession, user_id: int) -> None:
    """Mirror the route composition: flush, commit, then post-commit effects."""
    service = deletion_service(db)
    deleted = await service.delete_account(user_id)
    await db.commit()
    await service.complete_account_deletion(user_id, deleted)


async def test_delete_account_given_a_failure_partway_expect_the_account_intact(
    setup_database: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:

    async with session() as db:
        user = await make_user(db)
        user_id = user.id
        story_ids = [
            await make_import(db, user_id, uuid4().hex),
            await make_import(db, user_id, uuid4().hex),
        ]
        await db.commit()

    try:
        async with session() as db:
            service = deletion_service(db)
            real_release = service._imports.release_reference
            calls = {"n": 0}

            async def exploding_release(ref):
                calls["n"] += 1
                if calls["n"] == K_FAIL_ON_RELEASE_CALL:
                    raise RuntimeError("boom")
                return await real_release(ref)

            monkeypatch.setattr(
                service._imports, "release_reference", exploding_release
            )

            with pytest.raises(RuntimeError):
                await service.delete_account(user_id)
            await db.rollback()

        async with session() as db:
            assert await db.scalar(select(User).where(User.id == user_id)) is not None
            surviving = await db.scalar(
                select(func.count()).select_from(Story).where(Story.id.in_(story_ids))
            )
            assert surviving == K_EXPECTED_SURVIVING_STORY_COUNT
    finally:
        await discard(user_id, story_ids)


async def test_delete_account_given_a_held_quota_lock_expect_deletion_waits(
    setup_database: None,
) -> None:

    async with session() as db:
        user = await make_user(db)
        user_id = user.id
        first_story = await make_import(db, user_id, uuid4().hex)
        await db.commit()

    story_ids = [first_story]
    try:
        async with session() as importing:
            await importing.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": f"quota:{user_id}"},
            )
            racing_story = await make_import(importing, user_id, uuid4().hex)
            story_ids.append(racing_story)

            async with session() as deleting:
                deletion = asyncio.create_task(
                    delete_account_as_route(deleting, user_id)
                )

                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(
                        asyncio.shield(deletion), timeout=BLOCKED_AFTER
                    )

                await importing.commit()
                await asyncio.wait_for(deletion, timeout=10)

        async with session() as db:
            assert await db.scalar(select(User).where(User.id == user_id)) is None
            orphans = await db.scalar(
                select(func.count()).select_from(Story).where(Story.id.in_(story_ids))
            )
            assert orphans == 0
    finally:
        await discard(user_id, story_ids)


async def test_delete_account_given_a_held_content_lock_expect_deletion_waits(
    setup_database: None,
) -> None:

    digest = uuid4().hex
    async with session() as db:
        user = await make_user(db)
        user_id = user.id
        story_ids = [await make_import(db, user_id, digest)]
        await db.commit()

    try:
        async with session() as competing:
            await competing.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": f"content:{digest}"},
            )

            async with session() as deleting:
                deletion = asyncio.create_task(
                    delete_account_as_route(deleting, user_id)
                )

                with pytest.raises(asyncio.TimeoutError):
                    await asyncio.wait_for(
                        asyncio.shield(deletion), timeout=BLOCKED_AFTER
                    )

                await competing.rollback()
                await asyncio.wait_for(deletion, timeout=10)

        async with session() as db:
            assert await db.scalar(select(User).where(User.id == user_id)) is None
            assert await db.get(Story, story_ids[0]) is None
    finally:
        await discard(user_id, story_ids)
