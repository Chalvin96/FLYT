from uuid import uuid4

import pytest
from sqlalchemy import insert
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaAlias
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.models import WordForm
from flyt.apps.lexicons.services import LexiconService
from flyt.apps.users.services import UserLemmaService
from tests.factories import CardPoolFactory
from tests.factories import LemmaAliasFactory
from tests.factories import LemmaFactory
from tests.factories import WordFormFactory
from tests.helpers.sql_log import capture_sql

pytestmark = pytest.mark.anyio

K_LOOKUP_CORPUS_SIZE = 10_000
K_FORMS_PER_LEMMA = 4
K_INDEXED_LOOKUP_TABLES = frozenset(
    {"lexicon_lemmas", "lexicon_word_forms", "lexicon_lemma_aliases"}
)


@pytest.fixture
async def lookup_corpus(db: AsyncSession) -> None:
    lemma_ids = list(
        await db.scalars(
            insert(Lemma).returning(Lemma.id),
            [
                {
                    "uuid": uuid4(),
                    "word": f"canonical-{index:05d}",
                    "pos": LemmaPos.NOUN,
                    "hgno": 1,
                    "primary_translation": "lookup corpus",
                }
                for index in range(K_LOOKUP_CORPUS_SIZE)
            ],
        )
    )
    await db.execute(
        insert(WordForm),
        [
            {
                "lemma_id": lemma_id,
                "form": f"form-{index:05d}-{variant}",
                "tags_json": [],
            }
            for index, lemma_id in enumerate(lemma_ids)
            for variant in range(K_FORMS_PER_LEMMA)
        ],
    )
    await db.execute(
        insert(LemmaAlias),
        [
            {
                "lemma_id": lemma_id,
                "alias": f"alias-{index:05d}",
                "normalized_alias": f"alias-{index:05d}",
            }
            for index, lemma_id in enumerate(lemma_ids)
        ],
    )
    for table in sorted(K_INDEXED_LOOKUP_TABLES):
        await db.execute(text(f"ANALYZE {table}"))
    db.expunge_all()


@pytest.mark.parametrize(
    ("operation", "query"),
    [
        ("search", "form-09999-0"),
        ("search", "alias-09999"),
        ("resolve", "FORM-09999-0"),
        ("resolve", "CANONICAL-09999"),
        ("resolve", "ALIAS-09999"),
        ("browse", "alias-09999"),
    ],
)
async def test_lexicon_lookup_given_large_corpus_expect_indexed_exact_scans(
    db: AsyncSession, lookup_corpus: None, operation: str, query: str
) -> None:
    service = LexiconService(db, UserLemmaService(db))

    with capture_sql(db) as executed:
        if operation == "search":
            result = await service.search_lemmas(query)
            assert [lemma.word for lemma in result] == ["canonical-09999"]
        elif operation == "resolve":
            resolution = await service.resolve_word(query)
            assert [lemma.word for lemma in resolution.lemmas] == ["canonical-09999"]
        else:
            headword = await service.resolve_headword(query)
            assert headword is not None
            assert len(headword.entries) == 1
    statement, parameters = next(
        (statement, parameters)
        for statement, parameters in executed
        if statement.startswith("SELECT lexicon_lemmas.")
    )
    connection = await db.connection()
    plan = (
        await connection.exec_driver_sql(
            f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {statement}", parameters
        )
    ).scalar_one()
    pending = [plan[0]["Plan"]]
    while pending:
        node = pending.pop()
        if node.get("Relation Name") in K_INDEXED_LOOKUP_TABLES:
            assert node["Node Type"] != "Seq Scan", node
        pending.extend(node.get("Plans", []))


@pytest.mark.parametrize("operation", ["search", "resolve"])
async def test_lexicon_lookup_given_overlapping_matches_expect_unique_stable_order(
    db: AsyncSession, operation: str
) -> None:
    unranked = await LemmaFactory.create(word="bok", hgno=1)
    lower_rank = await LemmaFactory.create(word="bok", hgno=1)
    first_tie = await LemmaFactory.create(word="bok", hgno=3)
    second_tie = await LemmaFactory.create(word="bok", hgno=3)
    lower_hgno = await LemmaFactory.create(word="bok", hgno=2)
    alias_only = await LemmaFactory.create(word="uttrykk", hgno=2)
    canonical_only = await LemmaFactory.create(word="bok", hgno=4)
    for lemma in (unranked, lower_rank, first_tie, second_tie, lower_hgno):
        await WordFormFactory.create(lemma=lemma, form="bok", tags_json=["Sing"])
        await WordFormFactory.create(lemma=lemma, form="bok", tags_json=["Plur"])
        await LemmaAliasFactory.create(lemma=lemma, normalized_alias="bok", alias="bok")
        await LemmaAliasFactory.create(
            lemma=lemma, normalized_alias="boka", alias="boka"
        )
    await LemmaAliasFactory.create(
        lemma=alias_only, normalized_alias="bok", alias="bok"
    )
    for lemma, rank in (
        (lower_rank, 30),
        (first_tie, 1),
        (second_tie, 1),
        (lower_hgno, 1),
        (alias_only, 2),
    ):
        await CardPoolFactory.create(lemma=lemma, frequency_rank=rank)
    service = LexiconService(db, UserLemmaService(db))
    db.expunge_all()

    if operation == "search":
        result = await service.search_lemmas("bok")
        expected = [unranked, lower_rank, lower_hgno, alias_only, first_tie, second_tie]
    else:
        resolution = await service.resolve_word("BOK")
        result = resolution.lemmas
        expected = [
            lower_hgno,
            first_tie,
            second_tie,
            alias_only,
            lower_rank,
            unranked,
            canonical_only,
        ]

    assert [lemma.id for lemma in result] == [lemma.id for lemma in expected]
