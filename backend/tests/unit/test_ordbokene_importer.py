import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from scripts.ordbokene_importer import get_article_lemmas
from scripts.ordbokene_importer import import_article
from scripts.ordbokene_importer import update_article

EXPECTED_IMPORTED_LEMMA_COUNT = 2
EXPECTED_DEFINITION_COUNT = 4
EXPECTED_NOUN_SOURCE_LEMMA_ID = 100
EXPECTED_EXISTING_LEMMA_COUNT = 2
EXPECTED_DISTINCT_LEMMA_COUNT = 2
EXPECTED_SEE_ALSO_COUNT = 2
DUPLICATE_SOURCE_LEMMA_ID = 5
BASIC_IMPORT_ARTICLE_ID = 900001
WORD_FORM_ARTICLE_ID = 900002
DEFINITION_ARTICLE_ID = 900003
NOUN_ARTICLE_ID = 900004
EXAMPLE_ARTICLE_ID = 900044
NUMERAL_ARTICLE_ID = 900007
UNKNOWN_POS_ARTICLE_ID = 900011
FIRST_SEE_ALSO_ARTICLE_ID = 111
SECOND_SEE_ALSO_ARTICLE_ID = 222
REDIRECT_ARTICLE_ID = 910003
UPDATED_SEE_ALSO_ARTICLE_ID = 501
EXPECTED_FREQUENCY_RANK = 5
ORIGINAL_FREQUENCY_RANK = 10
UPDATED_FREQUENCY_RANK = 2


def _build_lemma_payload(article_id: int, **overrides) -> dict:
    payload = {
        "source_article_id": article_id,
        "lemmas": [
            {
                "lemma": "dialektfarget",
                "hgno": 0,
                "pos": "ADJ",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "dialect-colored",
                "word_forms": [
                    {"word_form": "dialektfarget", "tags_json": ["Inf"]},
                    {"word_form": "dialektfargede", "tags_json": ["Plur"]},
                ],
            },
            {
                "lemma": "dialektfarga",
                "hgno": 0,
                "pos": "ADJ",
                "source_lemma_id": 2,
                "is_sub_article": False,
                "primary_translation": "dialect-colored",
                "word_forms": [
                    {"word_form": "dialektfarga", "tags_json": ["Inf"]},
                ],
            },
        ],
        "cross_reference": None,
        "definitions": [
            {
                "text": "definition one",
                "translation": "definition one translated",
                "examples": [],
            },
            {
                "text": "definition two",
                "translation": "definition two translated",
                "examples": [],
            },
        ],
    }
    payload.update(overrides)
    return payload


@pytest.mark.anyio
async def test_import_article_creates_lemmas_word_forms_and_definitions(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(article_id=900001)

    lemmas = await import_article(db, payload)

    assert len(lemmas) == EXPECTED_IMPORTED_LEMMA_COUNT

    db_lemmas = (
        await db.scalars(
            select(Lemma)
            .where(Lemma.source_article_id == BASIC_IMPORT_ARTICLE_ID)
            .order_by(Lemma.word)
        )
    ).all()
    assert len(db_lemmas) == EXPECTED_IMPORTED_LEMMA_COUNT
    assert db_lemmas[0].word == "dialektfarga"
    assert db_lemmas[1].word == "dialektfarget"
    assert db_lemmas[0].pos == LemmaPos.ADJECTIVE
    assert db_lemmas[1].pos == LemmaPos.ADJECTIVE
    assert db_lemmas[0].primary_translation == "dialect-colored"
    assert db_lemmas[1].primary_translation == "dialect-colored"


@pytest.mark.anyio
async def test_import_article_creates_word_forms(db: AsyncSession) -> None:
    payload = _build_lemma_payload(article_id=900002)

    await import_article(db, payload)

    word_forms = (
        await db.scalars(
            select(WordForm)
            .join(Lemma, WordForm.lemma_id == Lemma.id)
            .where(Lemma.source_article_id == WORD_FORM_ARTICLE_ID)
            .order_by(WordForm.form)
        )
    ).all()
    assert [wf.form for wf in word_forms] == [
        "dialektfarga",
        "dialektfargede",
        "dialektfarget",
    ]


@pytest.mark.anyio
async def test_import_article_creates_definitions_for_each_lemma(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(article_id=900003)

    await import_article(db, payload)

    definitions = (
        await db.scalars(
            select(Definition)
            .join(Lemma, Definition.lemma_id == Lemma.id)
            .where(Lemma.source_article_id == DEFINITION_ARTICLE_ID)
            .order_by(Definition.lemma_id, Definition.id)
        )
    ).all()

    assert len(definitions) == EXPECTED_DEFINITION_COUNT
    assert all(d.translation_source == "ordbokene_translation" for d in definitions)


@pytest.mark.anyio
async def test_import_article_given_noun_pos(db: AsyncSession) -> None:
    payload = _build_lemma_payload(
        article_id=900004,
        lemmas=[
            {
                "lemma": "fisk",
                "hgno": 1,
                "pos": "NOUN",
                "source_lemma_id": 100,
                "is_sub_article": False,
                "primary_translation": "fish",
                "word_forms": [
                    {"word_form": "fisk", "tags_json": ["Sing", "Ind"]},
                    {"word_form": "fisken", "tags_json": ["Sing", "Def"]},
                ],
            }
        ],
        definitions=[
            {
                "text": "akvatisk dyr",
                "translation": "aquatic animal",
                "examples": [{"no": "en fisk svømmer", "en": None}],
            }
        ],
    )

    await import_article(db, payload)

    lemma = await db.scalar(
        select(Lemma).where(Lemma.source_article_id == NOUN_ARTICLE_ID)
    )
    assert lemma is not None
    assert lemma.pos == LemmaPos.NOUN
    assert lemma.source_lemma_id == EXPECTED_NOUN_SOURCE_LEMMA_ID

    definitions = (
        await db.scalars(select(Definition).where(Definition.lemma_id == lemma.id))
    ).all()
    assert len(definitions) == 1
    assert definitions[0].examples_json == [{"no": "en fisk svømmer", "en": None}]


@pytest.mark.anyio
async def test_import_article_rejects_bare_string_examples(
    db: AsyncSession,
) -> None:
    """Schema-v3 importer requires {no, en} dicts — bare strings are rejected."""
    payload = _build_lemma_payload(
        article_id=900045,
        lemmas=[
            {
                "lemma": "x",
                "hgno": 0,
                "pos": "NOUN",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "x",
                "word_forms": [],
            }
        ],
        definitions=[
            {"text": "d", "translation": "t", "examples": ["legacy bare string"]}
        ],
    )
    with pytest.raises(TypeError, match="must be a \\{no, en\\} dict"):
        await import_article(db, payload)


@pytest.mark.anyio
async def test_import_article_rejects_non_string_en(db: AsyncSession) -> None:
    """Non-string en (e.g. int) fails fast at the import boundary, not silently nulled."""
    payload = _build_lemma_payload(
        article_id=900046,
        lemmas=[
            {
                "lemma": "x",
                "hgno": 0,
                "pos": "NOUN",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "x",
                "word_forms": [],
            }
        ],
        definitions=[
            {"text": "d", "translation": "t", "examples": [{"no": "ok", "en": 123}]}
        ],
    )
    with pytest.raises(TypeError, match="en must be a string or null"):
        await import_article(db, payload)


@pytest.mark.anyio
async def test_import_article_skips_lemmas_when_no_definitions(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(
        article_id=51263,
        lemmas=[
            {
                "lemma": "si",
                "hgno": 2,
                "pos": "NOUN",
                "source_lemma_id": 58967,
                "is_sub_article": False,
                "primary_translation": "si",
                "word_forms": [],
            }
        ],
        definitions=[],
    )

    lemmas = await import_article(db, payload)

    assert lemmas == []


@pytest.mark.anyio
async def test_import_article_drops_blank_text_definition(
    db: AsyncSession,
) -> None:
    # Blank Norwegian text is not a usable definition; with no translated def
    # left, the whole article's lemmas are skipped.
    payload = _build_lemma_payload(
        article_id=900047,
        definitions=[{"text": " ", "translation": "blank", "examples": []}],
    )

    lemmas = await import_article(db, payload)

    assert lemmas == []


@pytest.mark.anyio
async def test_import_article_drops_untranslated_definition(
    db: AsyncSession,
) -> None:
    # One translated + one untranslated def: the untranslated one is dropped,
    # the lemmas survive on the translated def alone.
    payload = _build_lemma_payload(
        article_id=900048,
        definitions=[
            {"text": "kept", "translation": "kept translated", "examples": []},
            {"text": "dropped", "examples": []},
        ],
    )

    lemmas = await import_article(db, payload)

    assert lemmas
    for lemma in lemmas:
        defns = (
            await db.scalars(select(Definition).where(Definition.lemma_id == lemma.id))
        ).all()
        assert [d.definition for d in defns] == ["kept"]


@pytest.mark.anyio
async def test_import_article_drops_blank_translation_definition(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(
        article_id=900049,
        definitions=[
            {"text": "kept", "translation": "kept translated", "examples": []},
            {"text": "dropped", "translation": "", "examples": []},
        ],
    )

    lemmas = await import_article(db, payload)

    assert lemmas
    for lemma in lemmas:
        defns = (
            await db.scalars(select(Definition).where(Definition.lemma_id == lemma.id))
        ).all()
        assert [d.definition for d in defns] == ["kept"]


@pytest.mark.anyio
async def test_import_article_normalizes_example_pairs(db: AsyncSession) -> None:
    """Schema-v3 source passes through; en=="" coerces to None (chokepoint D2)."""
    payload = _build_lemma_payload(
        article_id=900044,
        lemmas=[
            {
                "lemma": "lese",
                "hgno": 0,
                "pos": "VERB",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "read",
                "word_forms": [],
            }
        ],
        definitions=[
            {
                "text": "se på tekst",
                "translation": "look at text",
                "examples": [
                    {"no": "hun leser en bok", "en": "she is reading a book"},
                    {"no": "jeg leser avisen", "en": ""},
                ],
            }
        ],
    )

    await import_article(db, payload)

    lemma = await db.scalar(
        select(Lemma).where(Lemma.source_article_id == EXAMPLE_ARTICLE_ID)
    )
    definitions = (
        await db.scalars(select(Definition).where(Definition.lemma_id == lemma.id))
    ).all()
    assert definitions[0].examples_json == [
        {"no": "hun leser en bok", "en": "she is reading a book"},
        {"no": "jeg leser avisen", "en": None},
    ]


@pytest.mark.anyio
async def test_import_article_given_is_sub_article(db: AsyncSession) -> None:
    payload = _build_lemma_payload(
        article_id=900005,
        lemmas=[
            {
                "lemma": "gjøren og laden",
                "hgno": 0,
                "pos": "UNKNOWN",
                "source_lemma_id": 1,
                "is_sub_article": True,
                "primary_translation": "doings and goings",
                "word_forms": [],
            }
        ],
        definitions=[
            {
                "text": "fast uttrykk",
                "translation": "fixed expression",
                "examples": [],
            }
        ],
    )

    lemmas = await import_article(db, payload)

    assert len(lemmas) == 1
    assert lemmas[0].is_sub_article is True
    assert lemmas[0].primary_translation == "doings and goings"


@pytest.mark.anyio
async def test_import_article_skips_lemma_with_null_primary_translation(
    db: AsyncSession,
) -> None:
    # A translated definition is present, but the lemma has no primary
    # translation, so it cannot make a usable card and is skipped.
    payload = _build_lemma_payload(
        article_id=900006,
        lemmas=[
            {
                "lemma": "praktildkvede",
                "hgno": 1,
                "pos": "NOUN",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": None,
                "word_forms": [],
            }
        ],
        cross_reference={"article_id": 25773, "lemma": "ildkvede"},
        definitions=[
            {
                "text": "plante",
                "translation": "plant",
                "examples": [],
            }
        ],
    )

    lemmas = await import_article(db, payload)

    assert lemmas == []


@pytest.mark.anyio
async def test_import_article_given_num_pos_maps_to_numeral(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(
        article_id=900007,
        lemmas=[
            {
                "lemma": "tre",
                "hgno": 1,
                "pos": "NUM",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "three",
                "word_forms": [],
            }
        ],
        definitions=[
            {"text": "tallet 3", "translation": "the number 3", "examples": []}
        ],
    )

    await import_article(db, payload)

    lemma = await db.scalar(
        select(Lemma).where(Lemma.source_article_id == NUMERAL_ARTICLE_ID)
    )
    assert lemma is not None
    assert lemma.pos == LemmaPos.NUMERAL


@pytest.mark.anyio
async def test_import_article_given_unmapped_pos_maps_to_unknown(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(
        article_id=900011,
        lemmas=[
            {
                "lemma": "xyz",
                "hgno": 1,
                "pos": "ZZUNKNOWN",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "?",
                "word_forms": [],
            }
        ],
        definitions=[
            {
                "text": "ukjent ordklasse",
                "translation": "unknown part of speech",
                "examples": [],
            }
        ],
    )

    await import_article(db, payload)

    lemma = await db.scalar(
        select(Lemma).where(Lemma.source_article_id == UNKNOWN_POS_ARTICLE_ID)
    )
    assert lemma is not None
    assert lemma.pos == LemmaPos.UNKNOWN


@pytest.mark.anyio
async def test_import_article_given_existing_article_returns_existing_lemmas(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(article_id=900008)
    await import_article(db, payload)

    existing = await get_article_lemmas(db, 900008)
    assert len(existing) == EXPECTED_EXISTING_LEMMA_COUNT


@pytest.mark.anyio
async def test_import_article_duplicate_article_id_fails_cleanly(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(article_id=900012)
    await import_article(db, payload)

    with pytest.raises(IntegrityError):
        await import_article(db, payload)


@pytest.mark.anyio
async def test_import_article_given_zero_hgno(db: AsyncSession) -> None:
    payload = _build_lemma_payload(
        article_id=900009,
        lemmas=[
            {
                "lemma": "test",
                "hgno": 0,
                "pos": "VERB",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "test",
                "word_forms": [],
            }
        ],
        definitions=[{"text": "testdefinisjon", "translation": "test", "examples": []}],
    )

    lemmas = await import_article(db, payload)
    assert lemmas[0].hgno == 0


@pytest.mark.anyio
async def test_import_article_given_null_hgno_defaults_to_one(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(
        article_id=900010,
        lemmas=[
            {
                "lemma": "test",
                "hgno": None,
                "pos": "VERB",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "test",
                "word_forms": [],
            }
        ],
        definitions=[{"text": "testdefinisjon", "translation": "test", "examples": []}],
    )

    lemmas = await import_article(db, payload)
    assert lemmas[0].hgno == 1


@pytest.mark.anyio
async def test_import_article_given_empty_lemmas_returns_empty(
    db: AsyncSession,
) -> None:
    payload = _build_lemma_payload(article_id=900099, lemmas=[], definitions=[])

    lemmas = await import_article(db, payload)

    assert lemmas == []


@pytest.mark.anyio
async def test_import_article_given_same_word_pos_hgno_distinct_source_ids_expect_both_kept(
    db: AsyncSession,
) -> None:
    """Distinct senses that share (word, pos, hgno) are separate lemmas — identity
    is source_lemma_id, so neither is dropped (was a real data-loss bug)."""
    payload = _build_lemma_payload(
        article_id=900100,
        lemmas=[
            {
                "lemma": "måse",
                "pos": "NOUN",
                "hgno": 0,
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "seagull",
            },
            {
                "lemma": "måse",
                "pos": "NOUN",
                "hgno": 0,
                "source_lemma_id": 2,
                "is_sub_article": False,
                "primary_translation": "seagull",
            },
        ],
        definitions=[{"text": "fugl", "translation": "bird", "examples": []}],
    )

    lemmas = await import_article(db, payload)

    assert len(lemmas) == EXPECTED_DISTINCT_LEMMA_COUNT
    assert sorted(lm.source_lemma_id for lm in lemmas) == [1, 2]


@pytest.mark.anyio
async def test_import_article_given_duplicate_source_lemma_id_expect_deduped(
    db: AsyncSession,
) -> None:
    """Two lemmas with the same source_lemma_id in one article collapse to one."""
    payload = _build_lemma_payload(
        article_id=900101,
        lemmas=[
            {
                "lemma": "måse",
                "pos": "NOUN",
                "hgno": 1,
                "source_lemma_id": DUPLICATE_SOURCE_LEMMA_ID,
                "is_sub_article": False,
                "primary_translation": "seagull",
            },
            {
                "lemma": "måse",
                "pos": "NOUN",
                "hgno": 2,
                "source_lemma_id": DUPLICATE_SOURCE_LEMMA_ID,
                "is_sub_article": False,
                "primary_translation": "seagull",
            },
        ],
        definitions=[{"text": "fugl", "translation": "bird", "examples": []}],
    )

    lemmas = await import_article(db, payload)

    assert len(lemmas) == 1
    assert lemmas[0].source_lemma_id == DUPLICATE_SOURCE_LEMMA_ID


@pytest.mark.anyio
async def test_update_article_refreshes_fields_and_children_preserving_pk(
    db: AsyncSession,
) -> None:
    original = _build_lemma_payload(
        article_id=800001,
        lemmas=[
            {
                "lemma": "old",
                "hgno": 1,
                "pos": "NOUN",
                "source_lemma_id": 42,
                "is_sub_article": False,
                "primary_translation": "old translation",
                "word_forms": [{"word_form": "old_form", "tags_json": ["Sing"]}],
            }
        ],
        definitions=[{"text": "old def", "translation": "old", "examples": []}],
    )
    lemmas = await import_article(db, original)
    original_pk = lemmas[0].id

    updated_payload = _build_lemma_payload(
        article_id=800001,
        lemmas=[
            {
                "lemma": "new",
                "hgno": 1,
                "pos": "VERB",
                "source_lemma_id": 42,
                "is_sub_article": False,
                "primary_translation": "new translation",
                "word_forms": [{"word_form": "new_form", "tags_json": ["Inf"]}],
            }
        ],
        definitions=[
            {
                "text": "new def",
                "translation": "new",
                "examples": [{"no": "ex", "en": None}],
            }
        ],
        cross_reference=None,
    )
    existing = await get_article_lemmas(db, 800001)
    result = await update_article(db, updated_payload, existing)

    assert len(result) == 1
    updated = result[0]
    assert updated.id == original_pk  # PK preserved — card pool FKs stay valid
    assert updated.word == "new"
    assert updated.pos == LemmaPos.VERB
    assert updated.primary_translation == "new translation"

    wf_forms = await db.scalars(
        select(WordForm).where(WordForm.lemma_id == original_pk)
    )
    assert [wf.form for wf in wf_forms] == ["new_form"]

    defns = await db.scalars(
        select(Definition).where(Definition.lemma_id == original_pk)
    )
    defn_list = list(defns)
    assert len(defn_list) == 1
    assert defn_list[0].definition == "new def"
    assert defn_list[0].translation == "new"


# ── see_also cross-references ────────────────────────────────────────────────


def _single_lemma_payload(article_id: int, **overrides) -> dict:
    payload = {
        "source_article_id": article_id,
        "lemmas": [
            {
                "lemma": "test",
                "hgno": 1,
                "pos": "NOUN",
                "source_lemma_id": 1,
                "is_sub_article": False,
                "primary_translation": "test",
                "word_forms": [],
            }
        ],
        "cross_reference": None,
        "definitions": [
            {"text": "real def", "translation": "real translation", "examples": []}
        ],
        "see_also": [],
    }
    payload.update(overrides)
    return payload


@pytest.mark.anyio
async def test_import_mixed_article_keeps_definitions_and_adds_see_also(
    db: AsyncSession,
) -> None:
    """A mixed article keeps its real definitions AND gets see_also rows."""
    payload = _single_lemma_payload(
        article_id=910001,
        see_also=[
            {"article_id": 111, "lemma": "mål", "relation": "see"},
            {"article_id": 222, "lemma": "teknikk", "relation": "compare"},
        ],
    )

    lemmas = await import_article(db, payload)
    lemma = lemmas[0]

    # Real definitions preserved.
    defns = (
        await db.scalars(select(Definition).where(Definition.lemma_id == lemma.id))
    ).all()
    assert len(defns) == 1
    assert defns[0].definition == "real def"

    # see_also rows with correct relation and ordinal.
    see_rows = (
        await db.scalars(
            select(SeeAlso)
            .where(SeeAlso.lemma_id == lemma.id)
            .order_by(SeeAlso.ordinal)
        )
    ).all()
    assert len(see_rows) == EXPECTED_SEE_ALSO_COUNT
    assert see_rows[0].target_article_id == FIRST_SEE_ALSO_ARTICLE_ID
    assert see_rows[0].target_word == "mål"
    assert see_rows[0].relation == "see"
    assert see_rows[0].ordinal == 0
    assert see_rows[1].target_article_id == SECOND_SEE_ALSO_ARTICLE_ID
    assert see_rows[1].target_word == "teknikk"
    assert see_rows[1].relation == "compare"
    assert see_rows[1].ordinal == 1


@pytest.mark.anyio
async def test_import_multi_target_see_also(db: AsyncSession) -> None:
    """Se: a, b -> 2 see_also rows."""
    payload = _single_lemma_payload(
        article_id=910002,
        see_also=[
            {"article_id": 301, "lemma": "kjerring", "relation": "see"},
            {"article_id": 302, "lemma": "reise", "relation": "see"},
        ],
    )

    lemmas = await import_article(db, payload)

    see_rows = (
        await db.scalars(
            select(SeeAlso)
            .where(SeeAlso.lemma_id == lemmas[0].id)
            .order_by(SeeAlso.ordinal)
        )
    ).all()
    assert len(see_rows) == EXPECTED_SEE_ALSO_COUNT
    assert [r.target_word for r in see_rows] == ["kjerring", "reise"]


@pytest.mark.anyio
async def test_import_pure_redirect_dropped_without_definition(
    db: AsyncSession,
) -> None:
    """A pure redirect (empty defs + cross_reference) has no translated
    definition, so it is dropped — a navigation alias is not a learnable card."""
    payload = _single_lemma_payload(
        article_id=910003,
        cross_reference={"article_id": 999, "lemma": "hovedord"},
        definitions=[],
        see_also=[],
    )

    lemmas = await import_article(db, payload)

    assert lemmas == []
    persisted = (
        await db.scalars(
            select(Lemma).where(Lemma.source_article_id == REDIRECT_ARTICLE_ID)
        )
    ).all()
    assert persisted == []


@pytest.mark.anyio
async def test_import_non_xref_empty_defs_skipped(
    db: AsyncSession,
) -> None:
    """Empty definitions without a cross_reference are skipped, not raised."""
    payload = _single_lemma_payload(
        article_id=910004,
        definitions=[],
        see_also=[],
    )

    lemmas = await import_article(db, payload)

    assert lemmas == []


@pytest.mark.anyio
async def test_update_article_skips_lemma_that_loses_translation(
    db: AsyncSession,
) -> None:
    """On re-import, a payload lemma that no longer qualifies is skipped
    wholesale — the existing row and its definition are left untouched."""
    original = _single_lemma_payload(article_id=810900)
    imported = await import_article(db, original)
    existing_id = imported[0].id
    await db.commit()

    degraded = _single_lemma_payload(
        article_id=810900,
        definitions=[{"text": "x", "translation": "", "examples": []}],
    )
    existing = await get_article_lemmas(db, 810900)
    result = await update_article(db, degraded, existing)

    assert result == []
    # Existing row survives unchanged, original definition intact.
    survivor = await db.get(Lemma, existing_id)
    assert survivor is not None
    defns = (
        await db.scalars(select(Definition).where(Definition.lemma_id == existing_id))
    ).all()
    assert [d.translation for d in defns] == ["real translation"]


@pytest.mark.anyio
async def test_update_article_replaces_see_also_rows(
    db: AsyncSession,
) -> None:
    """update_article deletes old see_also rows then inserts the new list."""
    original = _single_lemma_payload(
        article_id=810001,
        see_also=[
            {"article_id": 401, "lemma": "old1", "relation": "see"},
            {"article_id": 402, "lemma": "old2", "relation": "see"},
        ],
    )
    lemmas = await import_article(db, original)
    lemma_id = lemmas[0].id

    updated = _single_lemma_payload(
        article_id=810001,
        see_also=[{"article_id": 501, "lemma": "new1", "relation": "compare"}],
    )
    existing = await get_article_lemmas(db, 810001)
    await update_article(db, updated, existing)

    see_rows = (
        await db.scalars(
            select(SeeAlso)
            .where(SeeAlso.lemma_id == lemma_id)
            .order_by(SeeAlso.ordinal)
        )
    ).all()
    assert len(see_rows) == 1
    assert see_rows[0].target_article_id == UPDATED_SEE_ALSO_ARTICLE_ID
    assert see_rows[0].target_word == "new1"
    assert see_rows[0].relation == "compare"
    assert see_rows[0].ordinal == 0


@pytest.mark.anyio
async def test_import_see_also_defaults_to_empty(db: AsyncSession) -> None:
    """Articles without a see_also key produce 0 see_also rows."""
    payload = _single_lemma_payload(article_id=910005)
    payload.pop("see_also")

    lemmas = await import_article(db, payload)

    see_rows = (
        await db.scalars(select(SeeAlso).where(SeeAlso.lemma_id == lemmas[0].id))
    ).all()
    assert len(see_rows) == 0


# ── frequency_rank / frequency_ambiguous ─────────────────────────────────────


def _frequency_lemma_payload(article_id: int, **overrides) -> dict:
    payload = _single_lemma_payload(article_id=article_id)
    payload["lemmas"][0].update(
        {"lemma": "være", "hgno": 2, "pos": "VERB", "source_lemma_id": 80034}
    )
    payload["lemmas"][0].update(overrides)
    return payload


@pytest.mark.anyio
async def test_import_article_persists_frequency_rank_and_ambiguous(
    db: AsyncSession,
) -> None:
    payload = _frequency_lemma_payload(
        article_id=920001, frequency_rank=1, frequency_ambiguous=True
    )

    lemmas = await import_article(db, payload)

    refreshed = await db.get(Lemma, lemmas[0].id)
    assert refreshed.frequency_rank == 1
    assert refreshed.frequency_ambiguous is True


@pytest.mark.anyio
async def test_import_article_frequency_fields_default_when_absent(
    db: AsyncSession,
) -> None:
    payload = _frequency_lemma_payload(article_id=920002)

    lemmas = await import_article(db, payload)

    refreshed = await db.get(Lemma, lemmas[0].id)
    assert refreshed.frequency_rank is None
    assert refreshed.frequency_ambiguous is False


@pytest.mark.anyio
async def test_import_article_frequency_ambiguous_absent_defaults_false(
    db: AsyncSession,
) -> None:
    """Wire format only emits frequency_ambiguous when true; absent -> False."""
    payload = _frequency_lemma_payload(article_id=920003, frequency_rank=5)

    lemmas = await import_article(db, payload)

    refreshed = await db.get(Lemma, lemmas[0].id)
    assert refreshed.frequency_rank == EXPECTED_FREQUENCY_RANK
    assert refreshed.frequency_ambiguous is False


@pytest.mark.anyio
async def test_import_article_frequency_rank_null_persists(db: AsyncSession) -> None:
    payload = _frequency_lemma_payload(
        article_id=920004, frequency_rank=None, frequency_ambiguous=False
    )

    lemmas = await import_article(db, payload)

    refreshed = await db.get(Lemma, lemmas[0].id)
    assert refreshed.frequency_rank is None
    assert refreshed.frequency_ambiguous is False


@pytest.mark.anyio
async def test_import_article_rejects_non_int_frequency_rank(
    db: AsyncSession,
) -> None:
    payload = _frequency_lemma_payload(
        article_id=920005, frequency_rank="1", frequency_ambiguous=False
    )

    with pytest.raises(ValueError, match="frequency_rank must be int or null"):
        await import_article(db, payload)


@pytest.mark.anyio
async def test_import_article_rejects_float_frequency_rank(db: AsyncSession) -> None:
    """JSON floats (e.g. 1.0) are not accepted — boundary matches strict validators."""
    payload = _frequency_lemma_payload(
        article_id=920006, frequency_rank=1.5, frequency_ambiguous=False
    )

    with pytest.raises(ValueError, match="frequency_rank must be int or null"):
        await import_article(db, payload)


@pytest.mark.anyio
async def test_update_article_updates_frequency_fields_in_place(
    db: AsyncSession,
) -> None:
    """--force update path (update_article) refreshes frequency fields on existing rows."""
    original = _frequency_lemma_payload(
        article_id=920007, frequency_rank=10, frequency_ambiguous=False
    )
    lemmas = await import_article(db, original)
    lemma_id = lemmas[0].id
    assert lemmas[0].frequency_rank == ORIGINAL_FREQUENCY_RANK

    updated = _frequency_lemma_payload(
        article_id=920007, frequency_rank=2, frequency_ambiguous=True
    )
    existing = await get_article_lemmas(db, 920007)
    result = await update_article(db, updated, existing)

    assert len(result) == 1
    assert result[0].id == lemma_id  # PK preserved
    refreshed = await db.get(Lemma, lemma_id)
    assert refreshed.frequency_rank == UPDATED_FREQUENCY_RANK
    assert refreshed.frequency_ambiguous is True


@pytest.mark.anyio
async def test_update_article_clears_frequency_rank_on_reimport(
    db: AsyncSession,
) -> None:
    """Re-import without frequency_rank clears the field (rank dropped upstream)."""
    original = _frequency_lemma_payload(
        article_id=920008, frequency_rank=7, frequency_ambiguous=True
    )
    lemmas = await import_article(db, original)
    lemma_id = lemmas[0].id

    # Re-import with the field absent.
    updated = _frequency_lemma_payload(article_id=920008)
    existing = await get_article_lemmas(db, 920008)
    await update_article(db, updated, existing)

    refreshed = await db.get(Lemma, lemma_id)
    assert refreshed.frequency_rank is None
    assert refreshed.frequency_ambiguous is False
