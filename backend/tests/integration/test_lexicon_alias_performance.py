"""PostgreSQL coverage for indexed expression-alias lookup.

The corpus is intentionally large enough to make a sequential alias scan
visible while remaining cheap for the disposable integration database.  The
latency check compares the old canonical-only predicates with the combined
lookup predicates on the same rows; it is a guardrail, not the sole correctness
assertion.
"""

from math import ceil
import time
from uuid import uuid4

import pytest
from sqlalchemy import insert
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaAlias
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.constants import K_LEXICON_SUGGESTIONS_LIMIT
from flyt.apps.lexicons.services import LexiconService
from flyt.apps.users.services import UserLemmaService
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

pytestmark = pytest.mark.anyio

K_ALIAS_CORPUS_SIZE = 10_000
K_BENCHMARK_ITERATIONS = 40
K_P95_QUANTILE = 0.95
K_P95_REGRESSION_FRACTION = 0.10
K_P95_REGRESSION_FLOOR_SECONDS = 0.005


async def _seed_alias_corpus(db: AsyncSession) -> None:
    lemma_rows = [
        {
            "uuid": uuid4(),
            "source_article_id": 2_000_000 + index,
            "source_lemma_id": 1,
            "word": f"canonical-{index:05d}",
            "pos": LemmaPos.EXPRESSION,
            "hgno": 1,
            "is_sub_article": False,
            "primary_translation": "benchmark",
            "frequency_rank": index + 1,
            "frequency_ambiguous": False,
        }
        for index in range(K_ALIAS_CORPUS_SIZE)
    ]
    result = await db.execute(insert(Lemma).returning(Lemma.id), lemma_rows)
    lemma_ids = [row[0] for row in result]
    alias_rows = [
        {
            "lemma_id": lemma_id,
            "alias": f"expression-{index:05d}",
            "normalized_alias": f"expression-{index:05d}",
            "is_primary": True,
            "ordinal": 0,
        }
        for index, lemma_id in enumerate(lemma_ids)
    ]
    await db.execute(insert(LemmaAlias), alias_rows)
    await db.execute(text("ANALYZE lexicon_lemmas"))
    await db.execute(text("ANALYZE lexicon_lemma_aliases"))


def _plan_nodes(plan: list[dict]) -> list[dict]:
    nodes: list[dict] = []

    def visit(node: dict) -> None:
        nodes.append(node)
        for child in node.get("Plans", []):
            visit(child)

    visit(plan[0]["Plan"])
    return nodes


async def _explain_statement(db: AsyncSession, statement) -> list[dict]:
    compiled = statement.compile(
        dialect=postgresql.dialect(),
        compile_kwargs={"literal_binds": True},
    )
    row = await db.scalar(text(f"EXPLAIN (FORMAT JSON) {compiled}"))
    assert row is not None
    return _plan_nodes(row)


def _alias_plan_nodes(nodes: list[dict]) -> list[dict]:
    return [
        node for node in nodes if node.get("Relation Name") == "lexicon_lemma_aliases"
    ]


async def test_alias_plans_given_exact_and_prefix_queries_expect_index_usage(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    await _seed_alias_corpus(async_session)
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )

    exact_nodes = await _explain_statement(
        async_session,
        service._build_ranked_headword_candidates_query(
            "expression-09999", limit=K_LEXICON_SUGGESTIONS_LIMIT
        ),
    )
    prefix_nodes = await _explain_statement(
        async_session,
        service._build_ranked_headword_candidates_query(
            "expression-099", limit=K_LEXICON_SUGGESTIONS_LIMIT
        ),
    )

    for query_kind, nodes in (("exact", exact_nodes), ("prefix", prefix_nodes)):
        alias_nodes = _alias_plan_nodes(nodes)
        assert alias_nodes, f"{query_kind} plan did not include alias relation"
        assert all(node["Node Type"] != "Seq Scan" for node in alias_nodes), (
            f"{query_kind} alias plan used a sequential scan: {alias_nodes}"
        )
        alias_index_nodes = [
            node
            for node in nodes
            if node.get("Index Name", "").startswith(
                "ix_lexicon_lemma_aliases_normalized_"
            )
        ]
        assert alias_index_nodes, (
            f"{query_kind} alias plan did not use a normalized alias index: {nodes}"
        )
        assert any(
            "normalized_alias" in str(node.get("Index Cond", ""))
            for node in alias_index_nodes
        ), f"{query_kind} plan index does not constrain normalized_alias"

    for query_kind, nodes in (("exact", exact_nodes), ("prefix", prefix_nodes)):
        root = nodes[0]
        assert root["Node Type"] == "Limit", (
            f"{query_kind} plan must limit the ranked result in SQL: {nodes}"
        )
        assert root["Plan Rows"] <= K_LEXICON_SUGGESTIONS_LIMIT, (
            f"{query_kind} plan exceeds the SQL result bound: {nodes}"
        )


async def test_lemma_load_given_ordinary_lemma_expect_no_alias_query(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    await async_session.execute(
        insert(Lemma).values(
            uuid=uuid4(),
            source_article_id=2_100_000,
            source_lemma_id=1,
            word="ordinary",
            pos=LemmaPos.NOUN,
            hgno=1,
            is_sub_article=False,
            primary_translation="ordinary",
            frequency_rank=1,
            frequency_ambiguous=False,
        )
    )

    with capture_sql(async_session) as executed:
        lemma = await async_session.scalar(
            select(Lemma).where(Lemma.word == "ordinary")
        )

    assert lemma is not None
    assert statements_reading(executed, "lexicon_lemma_aliases") == []


async def _p95_seconds(db: AsyncSession, statement) -> float:
    for _ in range(5):
        await db.execute(statement)
    durations: list[float] = []
    for _ in range(K_BENCHMARK_ITERATIONS):
        started = time.perf_counter()
        await db.execute(statement)
        durations.append(time.perf_counter() - started)
    durations.sort()
    return durations[ceil(K_P95_QUANTILE * K_BENCHMARK_ITERATIONS) - 1]


async def test_alias_lookup_given_large_corpus_expect_p95_within_budget(  # ume-ignore: UME-PY003
    async_session: AsyncSession,
) -> None:
    await _seed_alias_corpus(async_session)
    service = LexiconService(
        async_session, user_lemma_service=UserLemmaService(async_session)
    )
    ranked_suggestion = service._build_ranked_headword_candidates_query(
        "expression-099", limit=K_LEXICON_SUGGESTIONS_LIMIT
    )
    enriched_suggestion = service._build_suggestion_entries_query("expression-099")

    before_suggestion_p95 = await _p95_seconds(async_session, ranked_suggestion)
    after_suggestion_p95 = await _p95_seconds(async_session, enriched_suggestion)

    budget = before_suggestion_p95 + max(
        before_suggestion_p95 * K_P95_REGRESSION_FRACTION,
        K_P95_REGRESSION_FLOOR_SECONDS,
    )
    assert after_suggestion_p95 <= budget, (
        "suggestion enrichment p95 regression exceeded budget: "
        f"before={before_suggestion_p95:.6f}s "
        f"after={after_suggestion_p95:.6f}s budget={budget:.6f}s"
    )
