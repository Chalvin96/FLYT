"""Mark abandoned generations failed and clear expired generated content."""

import argparse
import asyncio

from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy import update

from flyt.apps.story_generation.constants import StoryGenerationErrorCode
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.retention import retention_cutoff
from flyt.core.db import AsyncSessionLocal

_FAILURE_MESSAGE = "Generation worker did not complete."


async def settle_expired_generations(dry_run: bool) -> tuple[int, int, int]:
    cutoff = retention_cutoff()

    async with AsyncSessionLocal() as db:
        if dry_run:
            abandoned_rows = (
                await db.execute(
                    select(Generation.id, Generation.user_id)
                    .where(Generation.outcome == GenerationOutcome.PROCESSING)
                    .where(Generation.created_at < cutoff)
                )
            ).all()
            expired_content_ids = (
                (
                    await db.execute(
                        select(Generation.id)
                        .where(Generation.created_at < cutoff)
                        .where(
                            or_(
                                Generation.topic.is_not(None),
                                Generation.text.is_not(None),
                                Generation.pages.is_not(None),
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
        else:
            abandoned_rows = (
                await db.execute(
                    update(Generation)
                    .where(
                        Generation.outcome == GenerationOutcome.PROCESSING,
                        Generation.created_at < cutoff,
                    )
                    .values(
                        outcome=GenerationOutcome.FAILED,
                        failure_code=StoryGenerationErrorCode.GENERATION_ABANDONED,
                        failure_message=_FAILURE_MESSAGE,
                    )
                    .returning(Generation.id, Generation.user_id)
                )
            ).all()
            expired_content_ids = (
                (
                    await db.execute(
                        update(Generation)
                        .where(
                            Generation.created_at < cutoff,
                            or_(
                                Generation.topic.is_not(None),
                                Generation.text.is_not(None),
                                Generation.pages.is_not(None),
                            ),
                        )
                        .values(topic=None, text=None, pages=None)
                        .returning(Generation.id)
                    )
                )
                .scalars()
                .all()
            )
            if abandoned_rows or expired_content_ids:
                await db.commit()

        return (
            len(abandoned_rows),
            len({row.user_id for row in abandoned_rows}),
            len(expired_content_ids),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mark abandoned story generations as failed and clear "
        "expired generated content."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report matching generations without changing them.",
    )
    args = parser.parse_args()
    abandoned, users, purged = asyncio.run(settle_expired_generations(args.dry_run))
    settle_action = "Would mark" if args.dry_run else "Marked"
    print(
        f"{settle_action} {abandoned} abandoned generation(s) "
        f"for {users} distinct user(s)."
    )
    purge_action = "Would clear" if args.dry_run else "Cleared"
    print(f"{purge_action} expired content from {purged} generation(s).")


if __name__ == "__main__":
    main()
