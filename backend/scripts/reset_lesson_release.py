#!/usr/bin/env python3
"""Destructive clean-start reset for the lesson content migration.

Drops every table in the target database, re-applies the schema from Alembic,
and optionally imports one lesson bundle. It is an authorized one-time content
rollout command; it is never run by the app at startup.

Usage:
    python scripts/reset_lesson_release.py --confirm reset-lesson-data \
        [--import <bundle-dir-or-tarball-or-https-url>]
"""

from __future__ import annotations

import argparse
import asyncio

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy import text

from flyt.core.config import settings
from flyt.core import model_registry  # noqa: F401  register full model graph


CONFIRM_PHRASE = "reset-lesson-data"


def assert_reset_target_is_safe() -> None:
    from sqlalchemy.engine import make_url

    if settings.ENV == "production":
        raise SystemExit("Refusing to reset a production environment.")

    url = make_url(settings.DATABASE_URL)
    host = (url.host or "").lower()
    if host not in {"", "localhost", "127.0.0.1"}:
        raise SystemExit(
            f"Refusing to reset non-local database host {host!r}. Point "
            "DATABASE_URL at a local database."
        )


def drop_all_tables() -> None:
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    engine.dispose()


def apply_migrations() -> None:
    config = Config("alembic.ini")
    config.set_main_option("script_location", "alembic")
    command.upgrade(config, "head")


async def import_lesson_content(source: str) -> None:
    from scripts.import_lessons import run as run_import

    await run_import(source, dry_run=False)


def main(confirm: str, source: str | None) -> None:
    if confirm != CONFIRM_PHRASE:
        raise SystemExit(
            f"This command destroys every table in the target database. Re-run "
            f"with --confirm {CONFIRM_PHRASE} after backing up anything you "
            "need."
        )
    assert_reset_target_is_safe()

    print(f"Resetting {settings.DATABASE_URL.split('@')[-1]} ...")
    drop_all_tables()
    apply_migrations()
    print("Schema re-applied from Alembic head.")

    if source is not None:
        asyncio.run(import_lesson_content(source))
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--confirm",
        default="",
        help="Required literal confirmation phrase for the destructive reset.",
    )
    parser.add_argument(
        "--import",
        dest="import_source",
        default=None,
        help="Optional lesson bundle to import after the reset.",
    )
    args = parser.parse_args()
    main(args.confirm, args.import_source)
