import asyncio
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.reading.annotation import K_DB_LOOKUP_CHUNK_SIZE
from flyt.apps.reading.annotation import load_lemmas_by_word
from flyt.apps.reading.annotation import load_word_forms_by_form

# Unit coverage of the POS tie-break deliberately bypasses I/O.
# ume-ignore: UME-PY002
from flyt.apps.reading.annotation import _ordered_candidates_by_pos
from flyt.apps.reading.annotation import build_pages
from flyt.apps.reading.tokenization import RawToken
from flyt.apps.reading.tokenization import paginate
from flyt.clients.tagger import TaggerCandidate
from tests.factories import LemmaFactory
from tests.factories import WordFormFactory

EXPECTED_KNOWN_TOKEN_START = 3
EXPECTED_KNOWN_TOKEN_END = 7
EXPECTED_MULTIPAGE_PAGE_COUNT = 3
EXPECTED_TOKEN_COUNT = 2
EXPECTED_LONG_STORY_PAGE_COUNT = 402
EXPECTED_HOMOGRAPH_PAGE_COUNT = 2
EXPECTED_LOOKUP_QUERY_COUNT = 2
EXPECTED_TAGGER_CONCURRENCY = 2


def test_paginate_splits_on_paragraph_boundaries_near_target() -> None:
    text = "aa bb\n\ncc dd\n\nee ff"
    pages = paginate(text, target_words=4)
    assert pages == ["aa bb\n\ncc dd", "ee ff"]


def test_paginate_single_short_text_is_one_page() -> None:
    assert paginate("en kort historie", target_words=300) == ["en kort historie"]


@pytest.mark.anyio
async def test_build_pages_given_known_word_form_expect_token_linked_to_lemma(
    async_session: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create()
    await WordFormFactory.create(lemma=lemma, form="katt")

    pages = await build_pages(async_session, "En katt.")
    tokens = pages[0].tokens

    by_word = {t["word"]: t for t in tokens}
    assert by_word["katt"]["lemmaUuid"] == str(lemma.uuid)
    assert by_word["En"]["lemmaUuid"] is None
    assert by_word["."]["lemmaUuid"] is None
    assert by_word["katt"]["start"] == EXPECTED_KNOWN_TOKEN_START
    assert by_word["katt"]["end"] == EXPECTED_KNOWN_TOKEN_END


@pytest.mark.anyio
async def test_build_pages_given_homographic_form_expect_pos_matching_lemma(
    async_session: AsyncSession,
) -> None:
    verb = await LemmaFactory.create(word="betale", pos=LemmaPos.VERB)
    noun = await LemmaFactory.create(word="betaler", pos=LemmaPos.NOUN)
    await WordFormFactory.create(lemma=verb, form="betaler", tags_json=["v2", "Pres"])
    await WordFormFactory.create(
        lemma=noun,
        form="betaler",
        tags_json=["Masc", "m2", "Sing", "Ind"],
    )

    pages = await build_pages(async_session, "Jeg betaler med kort.")
    tokens = pages[0].tokens

    by_word = {t["word"]: t for t in tokens}
    assert by_word["betaler"]["lemmaUuid"] == str(verb.uuid)


@pytest.mark.anyio
async def test_build_pages_given_missing_word_form_expect_predicted_lemma_fallback(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.apps.reading import annotation as tasks

    lemma = await LemmaFactory.create(word="sommer", pos=LemmaPos.NOUN)
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("sommeren", 0, 8, True, "sommer", "NOUN")] for _ in contents
        ],
    )

    pages = await build_pages(async_session, "sommeren")

    assert pages[0].tokens == [
        {"word": "sommeren", "start": 0, "end": 8, "lemmaUuid": str(lemma.uuid)}
    ]


@pytest.mark.anyio
async def test_build_pages_given_uppercase_stored_word_form_expect_resolves_from_lowercase_token(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: a WordForm stored with uppercase chars must resolve from a
    lowercase token. `load_word_forms_by_form` previously compared lowercased
    query strings against stored-case `form` values and keyed the result dict by
    stored case, so uppercase-stored forms silently dropped out of annotation.
    """
    from flyt.apps.reading import annotation as tasks

    lemma = await LemmaFactory.create()
    await WordFormFactory.create(lemma=lemma, form="Katt")
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("katt", 0, 4, True, "katt", "NOUN")] for _ in contents
        ],
    )

    pages = await build_pages(async_session, "katt")

    assert pages[0].tokens == [
        {"word": "katt", "start": 0, "end": 4, "lemmaUuid": str(lemma.uuid)}
    ]


def test_tokenizer_loads_spacy_model_given_reading_annotation_expect_parser_and_ner_excluded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: the cached reading tokenizer must load ``nb_core_news_md``
    with only ``parser`` and ``ner`` excluded so token text, offsets,
    ``is_alpha``, lemma, and POS outputs are preserved."""
    from flyt.apps.reading import tokenization

    captured: dict[str, Any] = {}

    class FakeDoc:
        def __iter__(self):
            return iter([])

    def fake_load(model_name: str, *, exclude: list[str] | None = None):
        captured["model_name"] = model_name
        captured["exclude"] = list(exclude or [])
        return lambda _text: FakeDoc()

    import spacy

    monkeypatch.setattr(spacy, "load", fake_load)
    tokenization.tokenizer.cache_clear()
    try:
        tokenization.tokenizer()
    finally:
        tokenization.tokenizer.cache_clear()

    assert captured["model_name"] == "nb_core_news_md"
    assert captured["exclude"] == ["parser", "ner"]


# ---------------------------------------------------------------------------
# Batch tokenization tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_build_pages_given_multiple_pages_expect_page_local_offsets(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Each page's first token must start at offset 0 when pages are tokenized
    through nlp.pipe, because offsets are relative to the page slice."""
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(tasks.settings, "READING_PAGE_TARGET_WORDS", 2)

    def fake_raw_tokens_batch(contents: list[str]) -> list[list[tuple]]:
        return [
            [RawToken(f"p{i}_w0", 0, 5, True, f"p{i}_w0", "NOUN")]
            for i in range(len(contents))
        ]

    monkeypatch.setattr(tasks, "raw_tokens_batch", fake_raw_tokens_batch)

    pages = await build_pages(async_session, "page one\n\npage two\n\npage three")

    assert len(pages) == EXPECTED_MULTIPAGE_PAGE_COUNT
    for page in pages:
        first_token = page.tokens[0]
        assert first_token["start"] == 0


@pytest.mark.anyio
async def test_build_pages_given_multiple_slices_expect_single_spacy_pipe_call(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(tasks.settings, "READING_PAGE_TARGET_WORDS", 2)

    call_count = 0

    def fake_raw_tokens_batch(contents: list[str]) -> list[list[tuple]]:
        nonlocal call_count
        call_count += 1
        return [[RawToken("w", 0, 1, True, "w", "NOUN")] for _ in contents]

    monkeypatch.setattr(tasks, "raw_tokens_batch", fake_raw_tokens_batch)

    await build_pages(async_session, "first page\n\nsecond page\n\nthird page")

    assert call_count == 1


@pytest.mark.anyio
async def test_build_pages_given_single_page_expect_existing_token_shape(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [
                RawToken("hei", 0, 3, True, "hei", "INTJ"),
                RawToken(".", 3, 4, False, "", "PUNCT"),
            ]
            for _ in contents
        ],
    )

    pages = await build_pages(async_session, "hei.")

    assert len(pages) == 1
    page = pages[0]
    assert len(page.tokens) == EXPECTED_TOKEN_COUNT
    for token in page.tokens:
        assert set(token.keys()) == {"word", "start", "end", "lemmaUuid"}


# ---------------------------------------------------------------------------
# POS-aware fallback tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("candidates", "expected_pos_values", "expected_order"),
    [
        (
            [
                TaggerCandidate(lemma="betaler", is_compound=False, pos="noun"),
                TaggerCandidate(lemma="betale", is_compound=False, pos="verb"),
            ],
            {"verb"},
            ["betale", "betaler"],
        ),
        (
            [
                TaggerCandidate(lemma="a", is_compound=False, pos=None),
                TaggerCandidate(lemma="b", is_compound=False, pos="noun"),
            ],
            set(),
            ["a", "b"],
        ),
        (
            [
                TaggerCandidate(lemma="a", is_compound=False, pos="noun"),
                TaggerCandidate(lemma="b", is_compound=False, pos="verb"),
                TaggerCandidate(lemma="c", is_compound=False, pos=None),
            ],
            {"verb"},
            ["b", "a", "c"],
        ),
    ],
)
def test_ordered_candidates_given_mixed_pos_expect_matching_first(
    candidates: list[TaggerCandidate],
    expected_pos_values: set[str],
    expected_order: list[str],
) -> None:
    ordered = _ordered_candidates_by_pos(candidates, expected_pos_values)

    assert [c.lemma for c in ordered] == expected_order


@pytest.mark.anyio
async def test_tagger_fallback_given_homograph_candidates_expect_pos_compatible_lemma(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the tagger returns multiple candidates for a surface form, the one
    whose morphology POS matches the token's spaCy POS should be resolved first."""
    from flyt.apps.reading import annotation as tasks

    verb_lemma = await LemmaFactory.create(word="spise", pos=LemmaPos.VERB)
    await LemmaFactory.create(word="spiser", pos=LemmaPos.NOUN)

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("spiser", 0, 6, True, "spise", "VERB")] for _ in contents
        ],
    )

    async def fake_analyze(_client, word):
        return [
            TaggerCandidate(lemma="spiser", is_compound=False, pos="noun"),
            TaggerCandidate(lemma="spise", is_compound=False, pos="verb"),
        ]

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    pages = await build_pages(async_session, "spiser")

    assert pages[0].tokens[0]["lemmaUuid"] == str(verb_lemma.uuid)


@pytest.mark.anyio
async def test_tagger_fallback_given_unknown_candidate_pos_expect_original_order(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the tagger returns no recognized POS, the existing candidate ordering
    must be used with no regression."""
    from flyt.apps.reading import annotation as tasks

    first_lemma = await LemmaFactory.create(word="forste", pos=LemmaPos.NOUN)
    await LemmaFactory.create(word="andre", pos=LemmaPos.NOUN)

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("forste", 0, 5, True, "forste", "NOUN")] for _ in contents
        ],
    )

    async def fake_analyze(_client, word):
        return [
            TaggerCandidate(lemma="forste", is_compound=False, pos=None),
            TaggerCandidate(lemma="andre", is_compound=False, pos=None),
        ]

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    pages = await build_pages(async_session, "forste")

    assert pages[0].tokens[0]["lemmaUuid"] == str(first_lemma.uuid)


@pytest.mark.anyio
async def test_tagger_fallback_given_compound_head_candidate_expect_head_lemma(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A compound candidate with a head lemma should resolve to the head's lemma."""
    from flyt.apps.reading import annotation as tasks

    head_lemma = await LemmaFactory.create(word="antall", pos=LemmaPos.NOUN)

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("innbyggerantall", 0, 15, True, "innbyggerantall", "NOUN")]
            for _ in contents
        ],
    )

    async def fake_analyze(_client, word):
        return [
            TaggerCandidate(lemma="antall", is_compound=True, pos="noun"),
        ]

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    pages = await build_pages(async_session, "innbyggerantall")

    assert pages[0].tokens[0]["lemmaUuid"] == str(head_lemma.uuid)


@pytest.mark.anyio
async def test_tagger_fallback_given_multiple_words_expect_one_client(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One annotation job must reuse one tagger client for all fallback words."""
    from flyt.apps.reading import annotation as tasks

    await LemmaFactory.create(word="lemma1", pos=LemmaPos.NOUN)
    await LemmaFactory.create(word="lemma2", pos=LemmaPos.NOUN)

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [
                RawToken("word1", 0, 5, True, "word1", "NOUN"),
                RawToken("word2", 6, 11, True, "word2", "NOUN"),
            ]
            for _ in contents
        ],
    )

    clients_seen: list = []

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def fake_open_session():
        fake_client = object()
        clients_seen.append(fake_client)
        yield fake_client

    async def fake_analyze(_client, word):
        return []

    monkeypatch.setattr(tasks.tagger_client, "open_session", fake_open_session)
    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    await build_pages(async_session, "word1 word2")

    assert len(clients_seen) == 1


@pytest.mark.anyio
async def test_tagger_fallback_given_unconfigured_service_expect_phase_skipped(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without TAGGER_SVC_URL the whole fallback phase is skipped: no session,
    no analyze calls."""
    from flyt.apps.reading import annotation as tasks
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", None)
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("ukjent", 0, 6, True, "ukjent", "NOUN")] for _ in contents
        ],
    )

    async def fail_analyze(_client, _word):
        raise AssertionError("tagger must not be called when unconfigured")

    monkeypatch.setattr(tasks.tagger_client, "analyze", fail_analyze)

    pages = await build_pages(async_session, "ukjent")

    assert pages[0].tokens[0]["lemmaUuid"] is None


# ---------------------------------------------------------------------------
# Fallback budget, per-POS resolution, and lookup chunking tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_tagger_fallback_given_many_pages_expect_lookup_budget_scales_per_page(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The tagger lookup cap is a per-page budget, not a per-story one."""
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(tasks.settings, "READING_PAGE_TARGET_WORDS", 1)

    words = [f"ukjent{i:03d}" for i in range(402)]
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [[RawToken(c, 0, len(c), True, c, "NOUN")] for c in contents],
    )

    analyzed: list[str] = []

    async def fake_analyze(_client, word):
        analyzed.append(word)
        return []

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    pages = await build_pages(async_session, "\n\n".join(words))

    assert len(pages) == EXPECTED_LONG_STORY_PAGE_COUNT
    assert len(analyzed) == EXPECTED_LONG_STORY_PAGE_COUNT


@pytest.mark.anyio
async def test_build_pages_given_same_form_in_two_pos_across_pages_expect_lemma_per_occurrence(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A surface form reading as NOUN on one page and VERB on another must
    resolve through the tagger to a different lemma per occurrence, not one
    story-wide uuid."""
    from flyt.apps.reading import annotation as tasks

    noun_lemma = await LemmaFactory.create(word="skog", pos=LemmaPos.NOUN)
    verb_lemma = await LemmaFactory.create(word="gikk", pos=LemmaPos.VERB)

    monkeypatch.setattr(tasks.settings, "READING_PAGE_TARGET_WORDS", 1)
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("form", 0, 4, True, f"form{i}", "NOUN" if i == 0 else "VERB")]
            for i in range(len(contents))
        ],
    )

    async def fake_analyze(_client, word):
        return [
            TaggerCandidate(lemma="skog", is_compound=False, pos="noun"),
            TaggerCandidate(lemma="gikk", is_compound=False, pos="verb"),
        ]

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    pages = await build_pages(async_session, "side en\n\nside to")

    assert len(pages) == EXPECTED_HOMOGRAPH_PAGE_COUNT
    assert pages[0].tokens[0]["lemmaUuid"] == str(noun_lemma.uuid)
    assert pages[1].tokens[0]["lemmaUuid"] == str(verb_lemma.uuid)


@pytest.mark.anyio
async def test_tagger_fallback_given_form_with_several_pos_expect_single_fetch(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One surface form with several POS values is one tagger request, reused
    for every (word, pos) key."""
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [
                RawToken("form", 0, 4, True, "formx", "NOUN"),
                RawToken("form", 5, 9, True, "formy", "VERB"),
            ]
            for _ in contents
        ],
    )

    analyzed: list[str] = []

    async def fake_analyze(_client, word):
        analyzed.append(word)
        return []

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    await build_pages(async_session, "form form")

    assert analyzed == ["form"]


@pytest.mark.anyio
async def test_load_word_forms_by_form_given_form_set_over_chunk_size_expect_chunked_union(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lemma = await LemmaFactory.create()
    first = await WordFormFactory.create(lemma=lemma, form="aaa")
    second = await WordFormFactory.create(lemma=lemma, form="aaa")
    tail = await WordFormFactory.create(lemma=lemma, form="zzz")

    forms = {"aaa", "zzz"} | {f"w{i:05d}" for i in range(K_DB_LOOKUP_CHUNK_SIZE - 1)}

    queries: list[object] = []
    original_scalars = async_session.scalars

    async def spy_scalars(statement):
        queries.append(statement)
        return await original_scalars(statement)

    monkeypatch.setattr(async_session, "scalars", spy_scalars)

    result = await load_word_forms_by_form(forms, async_session)

    assert len(queries) == EXPECTED_LOOKUP_QUERY_COUNT
    assert [wf.id for wf in result["aaa"]] == [first.id, second.id]
    assert [wf.id for wf in result["zzz"]] == [tail.id]


@pytest.mark.anyio
async def test_load_lemmas_by_word_given_word_set_over_chunk_size_expect_chunked_union(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first = await LemmaFactory.create(word="aaa", hgno=1)
    second = await LemmaFactory.create(word="aaa", hgno=2)
    tail = await LemmaFactory.create(word="zzz", hgno=1)

    words = {"aaa", "zzz"} | {f"w{i:05d}" for i in range(K_DB_LOOKUP_CHUNK_SIZE - 1)}

    queries: list[object] = []
    original_scalars = async_session.scalars

    async def spy_scalars(statement):
        queries.append(statement)
        return await original_scalars(statement)

    monkeypatch.setattr(async_session, "scalars", spy_scalars)

    result = await load_lemmas_by_word(words, async_session)

    assert len(queries) == EXPECTED_LOOKUP_QUERY_COUNT
    assert [lemma.id for lemma in result["aaa"]] == [first.id, second.id]
    assert [lemma.id for lemma in result["zzz"]] == [tail.id]


@pytest.mark.anyio
async def test_tagger_fallback_given_configured_concurrency_expect_settings_bound_fanout(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The fallback fan-out follows TAGGER_MAX_CONCURRENCY from settings, not a
    module constant."""
    from flyt.apps.reading import annotation as tasks

    monkeypatch.setattr(tasks.settings, "TAGGER_MAX_CONCURRENCY", 2)
    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [
                RawToken(f"ord{i}", i * 5, i * 5 + 4, True, f"lem{i}", "NOUN")
                for i in range(6)
            ]
            for _ in contents
        ],
    )

    in_flight = 0
    peak = 0

    async def fake_analyze(_client, word):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0)
        in_flight -= 1
        return []

    monkeypatch.setattr(tasks.tagger_client, "analyze", fake_analyze)
    from flyt.core.config import settings

    monkeypatch.setattr(settings, "TAGGER_SVC_URL", "http://tagger.test")

    await build_pages(async_session, " ".join(f"ord{i}" for i in range(6)))

    assert peak == EXPECTED_TAGGER_CONCURRENCY


@pytest.mark.anyio
async def test_build_pages_given_unknown_pos_lemma_sorts_first_expect_verb_wins(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: an unknown-POS lemma whose surface form collides with a real
    word (e.g. chemical symbol "Ta" vs verb "ta") must not win when spaCy
    reports a POS. The unknown-POS WordForm is created first so it sorts by id
    before the verb, reproducing the original bug."""
    from flyt.apps.reading import annotation as tasks

    symbol = await LemmaFactory.create(word="Ta", pos=LemmaPos.UNKNOWN)
    verb = await LemmaFactory.create(word="ta", pos=LemmaPos.VERB)
    await WordFormFactory.create(lemma=symbol, form="ta")
    await WordFormFactory.create(lemma=verb, form="ta")

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [[RawToken("ta", 0, 2, True, "ta", "VERB")] for _ in contents],
    )

    pages = await build_pages(async_session, "ta")

    assert pages[0].tokens[0]["lemmaUuid"] == str(verb.uuid)


@pytest.mark.anyio
async def test_build_pages_given_no_pos_signal_expect_non_unknown_lemma_preferred(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without a POS signal the resolver must still prefer a real POS over
    ``unknown`` so a chemical symbol or abbreviation never outranks a word a
    learner is actually likely to mean."""
    from flyt.apps.reading import annotation as tasks

    symbol = await LemmaFactory.create(word="Ta", pos=LemmaPos.UNKNOWN)
    verb = await LemmaFactory.create(word="ta", pos=LemmaPos.VERB)
    await WordFormFactory.create(lemma=symbol, form="ta")
    await WordFormFactory.create(lemma=verb, form="ta")

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [[RawToken("ta", 0, 2, True, "ta", "")] for _ in contents],
    )

    pages = await build_pages(async_session, "ta")

    assert pages[0].tokens[0]["lemmaUuid"] == str(verb.uuid)


@pytest.mark.anyio
async def test_build_pages_given_single_candidate_expect_resolution_unchanged(
    async_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A single-candidate resolution must be unaffected by the preference
    reordering."""
    from flyt.apps.reading import annotation as tasks

    lemma = await LemmaFactory.create(word="katt", pos=LemmaPos.NOUN)
    await WordFormFactory.create(lemma=lemma, form="katt")

    monkeypatch.setattr(
        tasks,
        "raw_tokens_batch",
        lambda contents: [
            [RawToken("katt", 0, 4, True, "katt", "NOUN")] for _ in contents
        ],
    )

    pages = await build_pages(async_session, "katt")

    assert pages[0].tokens[0]["lemmaUuid"] == str(lemma.uuid)
