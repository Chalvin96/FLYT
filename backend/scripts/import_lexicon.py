import argparse
import asyncio
import json
from dataclasses import dataclass
from pathlib import Path

import anyio
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.core.db import AsyncSessionLocal
from scripts._download_utils import resolve_data_dir
from scripts.ordbokene_importer import get_article_lemmas
from scripts.ordbokene_importer import import_article
from scripts.ordbokene_importer import update_article


@dataclass(frozen=True)
class ImportFailure:
    file_name: str
    error: str


@dataclass(frozen=True)
class ImportSummary:
    imported_articles: int = 0
    updated_articles: int = 0
    skipped_articles: int = 0
    failed_articles: int = 0
    imported_lemmas: int = 0
    updated_lemmas: int = 0
    skipped_lemmas: int = 0
    failures: tuple[ImportFailure, ...] = ()


def format_import_failure_message(summary: ImportSummary) -> str:
    message = f"Import completed with {summary.failed_articles} failure(s)"
    if not summary.failures:
        return message

    failure_details = "\n".join(
        f"- {failure.file_name}: {failure.error}" for failure in summary.failures
    )
    return f"{message}:\n{failure_details}"


async def load_json_file(file_path: anyio.Path) -> dict:
    return json.loads(await file_path.read_text(encoding="utf-8"))


async def import_lexicon(
    db: AsyncSession,
    lemma_dir: Path,
    *,
    force: bool = False,
) -> ImportSummary:
    async_lemma_dir = anyio.Path(lemma_dir)
    json_files = sorted(
        [path async for path in async_lemma_dir.glob("*.json")],
        key=lambda p: (0, int(p.stem)) if p.stem.isdigit() else (1, p.stem),
    )

    if not json_files:
        print(f"No JSON files found in {lemma_dir}")
        return ImportSummary()

    print(f"Found {len(json_files)} lemma files")
    summary = ImportSummary()

    for json_file in json_files:
        print(f"Processing {json_file.name}...")

        try:
            data = await load_json_file(json_file)
            article_id = data.get("source_article_id")
            if article_id is None:
                raise ValueError("Lemma payload is missing source_article_id")

            existing_lemmas = await get_article_lemmas(db, article_id)

            if existing_lemmas and not force:
                lemma_count = len(existing_lemmas)
                print(f"  Skipped {lemma_count} existing lemma(s)")
                summary = ImportSummary(
                    imported_articles=summary.imported_articles,
                    updated_articles=summary.updated_articles,
                    skipped_articles=summary.skipped_articles + 1,
                    failed_articles=summary.failed_articles,
                    imported_lemmas=summary.imported_lemmas,
                    updated_lemmas=summary.updated_lemmas,
                    skipped_lemmas=summary.skipped_lemmas + lemma_count,
                    failures=summary.failures,
                )
                continue

            if existing_lemmas:
                lemmas = await update_article(db, data, existing_lemmas)
                if not lemmas:
                    await db.rollback()
                    print("  Skipped article with no importable lemmas")
                    summary = ImportSummary(
                        imported_articles=summary.imported_articles,
                        updated_articles=summary.updated_articles,
                        skipped_articles=summary.skipped_articles + 1,
                        failed_articles=summary.failed_articles,
                        imported_lemmas=summary.imported_lemmas,
                        updated_lemmas=summary.updated_lemmas,
                        skipped_lemmas=summary.skipped_lemmas,
                        failures=summary.failures,
                    )
                    continue
                await db.commit()
                lemma_count = len(lemmas)
                print(f"  Updated {lemma_count} lemma(s)")
                summary = ImportSummary(
                    imported_articles=summary.imported_articles,
                    updated_articles=summary.updated_articles + 1,
                    skipped_articles=summary.skipped_articles,
                    failed_articles=summary.failed_articles,
                    imported_lemmas=summary.imported_lemmas,
                    updated_lemmas=summary.updated_lemmas + lemma_count,
                    skipped_lemmas=summary.skipped_lemmas,
                    failures=summary.failures,
                )
            else:
                lemmas = await import_article(db, data)
                if not lemmas:
                    await db.rollback()
                    print("  Skipped article with no importable lemmas")
                    summary = ImportSummary(
                        imported_articles=summary.imported_articles,
                        updated_articles=summary.updated_articles,
                        skipped_articles=summary.skipped_articles + 1,
                        failed_articles=summary.failed_articles,
                        imported_lemmas=summary.imported_lemmas,
                        updated_lemmas=summary.updated_lemmas,
                        skipped_lemmas=summary.skipped_lemmas,
                        failures=summary.failures,
                    )
                    continue
                await db.commit()
                lemma_count = len(lemmas)
                print(f"  Imported {lemma_count} lemma(s)")
                summary = ImportSummary(
                    imported_articles=summary.imported_articles + 1,
                    updated_articles=summary.updated_articles,
                    skipped_articles=summary.skipped_articles,
                    failed_articles=summary.failed_articles,
                    imported_lemmas=summary.imported_lemmas + lemma_count,
                    updated_lemmas=summary.updated_lemmas,
                    skipped_lemmas=summary.skipped_lemmas,
                    failures=summary.failures,
                )

        except Exception as e:
            await db.rollback()
            error = f"{type(e).__name__}: {e}"
            print(f"  Error importing {json_file.name}: {error}")
            summary = ImportSummary(
                imported_articles=summary.imported_articles,
                updated_articles=summary.updated_articles,
                skipped_articles=summary.skipped_articles,
                failed_articles=summary.failed_articles + 1,
                imported_lemmas=summary.imported_lemmas,
                updated_lemmas=summary.updated_lemmas,
                skipped_lemmas=summary.skipped_lemmas,
                failures=(
                    *summary.failures,
                    ImportFailure(file_name=json_file.name, error=error),
                ),
            )

    return summary


async def run_import(lemma_dir: Path, *, force: bool = False) -> None:
    async with AsyncSessionLocal() as db:
        summary = await import_lexicon(db, lemma_dir, force=force)
    parts = [
        f"{summary.imported_articles} imported article(s) ({summary.imported_lemmas} lemma(s))",
        f"{summary.updated_articles} updated article(s) ({summary.updated_lemmas} lemma(s))",
        f"{summary.skipped_articles} skipped article(s) ({summary.skipped_lemmas} lemma(s))",
        f"{summary.failed_articles} failed article(s)",
    ]
    print("Summary: " + ", ".join(parts))
    if summary.failed_articles:
        raise RuntimeError(format_import_failure_message(summary))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import Ordbokene lemma JSON files into the database"
    )
    parser.add_argument(
        "source",
        help="Lemma directory, local .tar.gz file, or https:// URL",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Update existing articles in-place instead of skipping them. "
        "Preserves lemma primary keys (flashcard links remain valid) while "
        "refreshing all fields, word forms, and definitions.",
    )
    args = parser.parse_args()
    try:
        with resolve_data_dir(args.source) as lemma_path:
            asyncio.run(run_import(lemma_path, force=args.force))
    except Exception as exc:
        print(f"Error: {exc}")
        raise SystemExit(1) from exc
