"""CLI: mark abandoned story generations as failed.

Usage:  cd backend && uv run python -m flyt.commands.settle_abandoned_generations
Requires DATABASE_URL.

The slot TTL is configured by ``STORY_GENERATION_EPHEMERAL_TTL_HOURS``. Minting
sets the slot fields and TTL atomically, so a processing row older than that
cutoff has no live Redis fence and cannot be a legitimately running generation.
Meant to be driven by an external scheduler (e.g. a Kubernetes CronJob); the app
does not run its own scheduler.
"""

import argparse
import asyncio
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy import update

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal
from flyt.libs.utils.date import now

_FAILURE_MESSAGE = "Generation worker did not complete."


async def reconcile_abandoned_generations(
    older_than_hours: float,
    dry_run: bool,
) -> tuple[int, int]:
    cutoff = now() - timedelta(hours=older_than_hours)

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(Generation.id, Generation.user_id)
                .where(Generation.outcome == GenerationOutcome.PROCESSING)
                .where(Generation.created_at < cutoff)
            )
        ).all()
        if not dry_run and rows:
            await db.execute(
                update(Generation)
                .where(Generation.id.in_([row.id for row in rows]))
                .values(
                    outcome=GenerationOutcome.FAILED,
                    failure_code=StoryGenerationErrorCode.GENERATION_ABANDONED,
                    failure_message=_FAILURE_MESSAGE,
                )
            )
            await db.commit()

        return len(rows), len({row.user_id for row in rows})


def _positive_hours(value: str) -> float:
    try:
        hours = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be a number of hours") from exc
    if hours <= 0:
        raise argparse.ArgumentTypeError("must be greater than zero")
    return hours


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mark abandoned story generations as failed."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report matching generations without changing them.",
    )
    parser.add_argument(
        "--older-than-hours",
        type=_positive_hours,
        default=settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS,
        help=(
            "Mark processing generations older than this many hours as failed "
            f"(default: {settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS})."
        ),
    )
    args = parser.parse_args()
    abandoned, users = asyncio.run(
        reconcile_abandoned_generations(args.older_than_hours, args.dry_run)
    )
    action = "Would mark" if args.dry_run else "Marked"
    print(f"{action} {abandoned} abandoned generation(s) for {users} distinct user(s).")


if __name__ == "__main__":
    main()
