"""CLI: re-enqueue imports stuck not-READY past the stale window (operational self-heal).

Usage:  cd backend && uv run python -m flyt.commands.requeue_stale_imports
Requires REDIS_URL (to enqueue) and DATABASE_URL.

Meant to be driven by an external scheduler (e.g. a Kubernetes CronJob); the app does
not run its own scheduler. Safe to run as often as you like: ``process_import`` claims
its row atomically, so re-enqueuing an import that is already running is a no-op.
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.constants import PROCESS_IMPORT_JOB
from flyt.apps.reading.constants import STALE_AFTER
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.core.db import AsyncSessionLocal
from flyt.core.queue import close_arq_pool
from flyt.core.queue import enqueue_job
from flyt.libs.utils.date import now


async def requeue_stale_imports(db: AsyncSession) -> int:
    """Re-enqueue every import still PENDING/PROCESSING past STALE_AFTER; return the count."""
    cutoff = now() - STALE_AFTER
    stale = (
        await db.scalars(
            select(ImportMeta.story_id).where(
                ImportMeta.status.in_((ImportStatus.PENDING, ImportStatus.PROCESSING)),
                ImportMeta.updated_at < cutoff,
            )
        )
    ).all()
    for story_id in stale:
        await enqueue_job(PROCESS_IMPORT_JOB, story_id)
    return len(stale)


async def _run() -> int:
    async with AsyncSessionLocal() as db:
        count = await requeue_stale_imports(db)
    await close_arq_pool()
    return count


def main() -> None:
    count = asyncio.run(_run())
    print(f"requeued {count} stale import(s)")


if __name__ == "__main__":
    main()
