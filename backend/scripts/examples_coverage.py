"""Report English-translation coverage of example sentences.

ONE-SHOT OPERATIONS TOOL — delete this file after the Phase-3 translated
import lands and coverage is confirmed. Not part of the app runtime; kept
only until the schema-v3 rollout completes.

After the schema-v3 backfill, every example is stored as ``{no, en}``. This
probe measures how many examples have a real English gloss (``en IS NOT NULL``)
vs. awaiting translation (``en IS NULL``). Run it after importing a translated
corpus from NorskLexicon to gauge coverage.

Usage:
  uv run python scripts/examples_coverage.py
"""

import asyncio

from sqlalchemy import text

from flyt.core.db import async_engine


async def report() -> None:
    async with async_engine.connect() as conn:
        row = (
            await conn.execute(
                text(
                    """
                    SELECT
                      count(*) AS total_defs,
                      count(*) FILTER (
                        WHERE jsonb_array_length(examples_json::jsonb) > 0
                      ) AS defs_with_examples,
                      coalesce(sum(jsonb_array_length(examples_json::jsonb)), 0) AS total_examples,
                      coalesce(sum(
                        (SELECT count(*) FROM jsonb_array_elements(examples_json::jsonb) e
                         WHERE e->>'en' IS NOT NULL)
                      ), 0) AS examples_translated
                    FROM lexicon_definitions
                    WHERE jsonb_typeof(examples_json::jsonb) = 'array'
                    """
                )
            )
        ).one()

    total_defs = row.total_defs
    defs_with_ex = row.defs_with_examples
    total_ex = row.total_examples
    translated = row.examples_translated
    pending = total_ex - translated
    coverage = (translated / total_ex * 100) if total_ex else 0.0

    print("Example translation coverage")
    print(f"  definitions total         : {total_defs:>10,}")
    print(f"  definitions with examples : {defs_with_ex:>10,}")
    print(f"  example sentences total   : {total_ex:>10,}")
    print(f"  translated (en present)   : {translated:>10,}")
    print(f"  pending (en IS NULL)      : {pending:>10,}")
    print(f"  coverage                  : {coverage:>9.2f}%")


def main() -> None:
    asyncio.run(report())


if __name__ == "__main__":
    main()
