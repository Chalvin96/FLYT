"""Integration tests for the external self-heal entrypoint.

``flyt.commands.requeue_stale_imports`` is run by an external scheduler, not an
in-process cron. It re-enqueues imports stuck not-READY past the stale window;
``enqueue_job`` is stubbed so no Redis is needed.
"""

from datetime import timedelta

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.commands import requeue_stale_imports as cmd
from flyt.apps.reading.constants import PROCESS_IMPORT_JOB
from flyt.apps.reading.constants import STALE_AFTER
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.libs.utils.date import now
from tests.factories import ImportMetaFactory

pytestmark = pytest.mark.anyio


@pytest.fixture
def enqueued(monkeypatch) -> list[tuple]:
    """Capture enqueue calls instead of hitting Redis."""
    calls: list[tuple] = []

    async def _fake_enqueue(name: str, *args) -> None:
        calls.append((name, args))

    monkeypatch.setattr(cmd, "enqueue_job", _fake_enqueue)
    return calls


async def _pending_import_at(db: AsyncSession, updated_at) -> ImportMeta:
    meta = await ImportMetaFactory.create(status=ImportStatus.PENDING)
    await db.execute(
        update(ImportMeta).where(ImportMeta.id == meta.id).values(updated_at=updated_at)
    )
    await db.flush()
    return meta


async def test_requeue_given_stale_pending_expect_requeued(
    db: AsyncSession, enqueued: list[tuple]
) -> None:
    # Arrange: a pending row older than the stale window.
    meta = await _pending_import_at(db, now() - STALE_AFTER - timedelta(minutes=1))

    # Act
    recovered = await cmd.requeue_stale_imports(db)

    # Assert
    assert recovered >= 1
    assert (PROCESS_IMPORT_JOB, (meta.story_id,)) in enqueued


async def test_requeue_given_fresh_pending_expect_skipped(
    db: AsyncSession, enqueued: list[tuple]
) -> None:
    # Arrange: a pending row within the stale window.
    meta = await _pending_import_at(db, now())

    # Act
    recovered = await cmd.requeue_stale_imports(db)

    # Assert
    assert recovered == 0
    assert (PROCESS_IMPORT_JOB, (meta.story_id,)) not in enqueued
