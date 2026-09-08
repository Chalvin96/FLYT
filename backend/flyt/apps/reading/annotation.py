"""Build annotated reading pages from source text.

Pagination and spaCy tokenization live in ``tokenization``; this module owns the
DB-bound resolution that turns raw tokens into lemma uuids — direct word-form
lookup, lemma lookup using spaCy's predicted lemma, and the tagger fallback — so
homographic forms can be resolved with lemma/POS context. One tagger HTTP client
is reused for the entire fallback batch.
"""

import asyncio
from collections.abc import Iterator
from typing import Any

import anyio
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.models import WordForm
from flyt.apps.reading.tokenization import PageData
from flyt.apps.reading.tokenization import RawToken
from flyt.apps.reading.tokenization import paginate
from flyt.apps.reading.tokenization import raw_tokens_batch
from flyt.clients import tagger as tagger_client
from flyt.clients.tagger import TaggerCandidate
from flyt.core.config import settings


_TAGGER_MAX_LOOKUPS_PER_PAGE = 400
K_DB_LOOKUP_CHUNK_SIZE = 5000


_SPACY_POS_TO_LEMMA_POS = {
    "ADJ": "adjective",
    "ADP": "preposition",
    "ADV": "adverb",
    "CCONJ": "conjunction",
    "DET": "determiner",
    "INTJ": "interjection",
    "NOUN": "noun",
    "NUM": "numeral",
    "PRON": "pronoun",
    "SCONJ": "conjunction",
    "VERB": "verb",
}


async def build_pages(db: AsyncSession, content: str) -> list[PageData]:
    """Paginate and annotate ``content`` — the shared curated/import core.

    All page slices are tokenized through one ``nlp.pipe`` call and annotated with
    shared DB lookups and one tagger HTTP client.
    """
    slices = paginate(content, settings.READING_PAGE_TARGET_WORDS)
    raw_tokens_per_page = await anyio.to_thread.run_sync(raw_tokens_batch, slices)
    tokens_per_page = await _annotate_all(raw_tokens_per_page, db)
    pages: list[PageData] = []
    for index, (slice_text, tokens) in enumerate(
        zip(slices, tokens_per_page, strict=True)
    ):
        pages.append(
            PageData(
                index=index,
                content=slice_text,
                tokens=tokens,
                word_count=len(slice_text.split()),
            )
        )
    return pages


async def load_word_forms_by_form(
    forms: set[str], db: AsyncSession
) -> dict[str, list[WordForm]]:
    word_forms_by_form: dict[str, list[WordForm]] = {}
    if not forms:
        return word_forms_by_form

    for chunk in _chunked(sorted(forms), K_DB_LOOKUP_CHUNK_SIZE):
        word_forms = (
            await db.scalars(
                select(WordForm)
                .options(selectinload(WordForm.lemma))
                .where(func.lower(WordForm.form).in_(chunk))
                .order_by(WordForm.id)
            )
        ).all()
        for word_form in word_forms:
            word_forms_by_form.setdefault(word_form.form.lower(), []).append(word_form)
    return word_forms_by_form


async def load_lemmas_by_word(
    words: set[str], db: AsyncSession
) -> dict[str, list[Lemma]]:
    lemmas_by_word: dict[str, list[Lemma]] = {}
    if not words:
        return lemmas_by_word

    for chunk in _chunked(sorted(words), K_DB_LOOKUP_CHUNK_SIZE):
        lemmas = (
            await db.scalars(
                select(Lemma)
                .where(func.lower(Lemma.word).in_(chunk))
                .order_by(Lemma.hgno.asc(), Lemma.id.asc())
            )
        ).all()
        for lemma in lemmas:
            lemmas_by_word.setdefault(lemma.word.lower(), []).append(lemma)
    return lemmas_by_word


def resolve_lemma_uuid(
    candidates: list[WordForm] | None,
    *,
    token_lemma: str,
    token_pos: str,
) -> str | None:
    if not candidates:
        return None

    expected_pos = _SPACY_POS_TO_LEMMA_POS.get(token_pos)

    if expected_pos is not None:
        for word_form in candidates:
            if (
                word_form.lemma.word.lower() == token_lemma
                and word_form.lemma.pos.value == expected_pos
            ):
                return str(word_form.lemma.uuid)

        for word_form in candidates:
            if word_form.lemma.pos.value == expected_pos:
                return str(word_form.lemma.uuid)

    word_matches = [wf for wf in candidates if wf.lemma.word.lower() == token_lemma]
    if word_matches:
        return _prefer_non_unknown(word_matches) or str(word_matches[0].lemma.uuid)

    return _prefer_non_unknown(candidates) or str(candidates[0].lemma.uuid)


def resolve_lemma_uuid_from_lemma(
    candidates: list[Lemma] | None,
    *,
    token_pos: str,
) -> str | None:
    if not candidates:
        return None

    expected_pos = _SPACY_POS_TO_LEMMA_POS.get(token_pos)
    if expected_pos is not None:
        for lemma in candidates:
            if lemma.pos.value == expected_pos:
                return str(lemma.uuid)

    return str(candidates[0].uuid)


def _chunked(values: list[str], size: int) -> Iterator[list[str]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def _prefer_non_unknown(word_forms: list[WordForm]) -> str | None:
    for word_form in word_forms:
        if word_form.lemma.pos is not LemmaPos.UNKNOWN:
            return str(word_form.lemma.uuid)
    return None


def _ordered_candidates_by_pos(
    candidates: list[TaggerCandidate],
    expected_pos_values: set[str],
) -> list[TaggerCandidate]:
    return sorted(candidates, key=lambda c: c.pos not in expected_pos_values)


def _resolve_first_pass(
    raw_tokens_per_page: list[list[RawToken]],
    word_forms_by_form: dict[str, list[WordForm]],
    lemmas_by_word: dict[str, list[Lemma]],
) -> tuple[list[list[dict[str, Any]]], set[tuple[str, str]]]:
    """Direct then spaCy-lemma resolution; returns page tokens and unresolved keys."""
    all_tokens: list[list[dict[str, Any]]] = []
    unresolved: set[tuple[str, str]] = set()
    for raw_tokens in raw_tokens_per_page:
        page_tokens: list[dict[str, Any]] = []
        for raw in raw_tokens:
            lemma_uuid = None
            if raw.is_word:
                lemma_uuid = resolve_lemma_uuid(
                    word_forms_by_form.get(raw.text.lower()),
                    token_lemma=raw.lemma,
                    token_pos=raw.pos,
                )
                if lemma_uuid is None and raw.lemma != raw.text.lower():
                    lemma_uuid = resolve_lemma_uuid_from_lemma(
                        lemmas_by_word.get(raw.lemma),
                        token_pos=raw.pos,
                    )
                if lemma_uuid is None and raw.pos != "PROPN":
                    unresolved.add((raw.text.lower(), raw.pos))
            page_tokens.append(
                {
                    "word": raw.text,
                    "start": raw.start,
                    "end": raw.end,
                    "lemmaUuid": lemma_uuid,
                }
            )
        all_tokens.append(page_tokens)
    return all_tokens, unresolved


async def _fetch_fallback_candidates(
    unresolved: set[tuple[str, str]],
    page_count: int,
) -> dict[str, list[TaggerCandidate]]:
    max_lookups = _TAGGER_MAX_LOOKUPS_PER_PAGE * page_count
    fallback_words = sorted({word for word, _pos in unresolved})[:max_lookups]
    tagger_semaphore = asyncio.Semaphore(settings.TAGGER_MAX_CONCURRENCY)

    async with tagger_client.open_session() as tagger_ctx:

        async def _fetch(word_lower: str) -> tuple[str, list[TaggerCandidate]]:
            async with tagger_semaphore:
                return word_lower, await tagger_client.analyze(tagger_ctx, word_lower)

        fetched = await asyncio.gather(*[_fetch(w) for w in fallback_words])
    return dict(fetched)


async def _resolve_fallback_uuids(
    unresolved: set[tuple[str, str]],
    word_to_candidates: dict[str, list[TaggerCandidate]],
    db: AsyncSession,
) -> dict[tuple[str, str], str]:
    candidate_forms = {
        cand.lemma.lower()
        for candidates in word_to_candidates.values()
        for cand in candidates
    }
    if not candidate_forms:
        return {}

    tagger_wf, tagger_lemmas = await asyncio.gather(
        load_word_forms_by_form(candidate_forms, db),
        load_lemmas_by_word(candidate_forms, db),
    )
    tagger_uuid: dict[tuple[str, str], str] = {}
    for word_lower, token_pos in unresolved:
        fetched_candidates = word_to_candidates.get(word_lower)
        if not fetched_candidates:
            continue
        expected = _SPACY_POS_TO_LEMMA_POS.get(token_pos)
        expected_pos_values = {expected} if expected is not None else set()
        ordered = _ordered_candidates_by_pos(fetched_candidates, expected_pos_values)
        for cand in ordered:
            cand_lemma = cand.lemma.lower()
            uuid = resolve_lemma_uuid(
                tagger_wf.get(cand_lemma),
                token_lemma=cand_lemma,
                token_pos=token_pos,
            ) or resolve_lemma_uuid_from_lemma(
                tagger_lemmas.get(cand_lemma), token_pos=token_pos
            )
            if uuid:
                tagger_uuid[word_lower, token_pos] = uuid
                break
    return tagger_uuid


def _apply_fallback_uuids(
    all_tokens: list[list[dict[str, Any]]],
    raw_tokens_per_page: list[list[RawToken]],
    tagger_uuid: dict[tuple[str, str], str],
) -> None:
    for page_tokens, raw_tokens in zip(all_tokens, raw_tokens_per_page, strict=True):
        for token, raw in zip(page_tokens, raw_tokens, strict=True):
            if token["lemmaUuid"] is None:
                token["lemmaUuid"] = tagger_uuid.get((token["word"].lower(), raw.pos))


async def _annotate_all(
    raw_tokens_per_page: list[list[RawToken]],
    db: AsyncSession,
) -> list[list[dict[str, Any]]]:
    """Annotate tokens for every page with shared DB lookups and one tagger client.

    Resolution order per token:
    1. Direct WordForm lookup on the surface form.
    2. Lemma.word lookup using spaCy's predicted lemma.
    3. Tagger fallback for unresolved non-proper-noun words (decompounding),
       keyed on (surface form, POS) so a homograph keeps the reading spaCy
       predicted at each occurrence.
    """
    alpha_forms: set[str] = set()
    lemma_words: set[str] = set()
    for raw_tokens in raw_tokens_per_page:
        for raw in raw_tokens:
            if raw.is_word:
                alpha_forms.add(raw.text.lower())
                lemma_words.add(raw.lemma)

    word_forms_by_form = await load_word_forms_by_form(alpha_forms, db)
    lemmas_by_word = await load_lemmas_by_word(lemma_words, db)

    all_tokens, unresolved = _resolve_first_pass(
        raw_tokens_per_page, word_forms_by_form, lemmas_by_word
    )
    if not unresolved or not settings.TAGGER_SVC_URL:
        return all_tokens

    word_to_candidates = await _fetch_fallback_candidates(
        unresolved, len(raw_tokens_per_page)
    )
    tagger_uuid = await _resolve_fallback_uuids(unresolved, word_to_candidates, db)
    _apply_fallback_uuids(all_tokens, raw_tokens_per_page, tagger_uuid)
    return all_tokens
