"""Import lemma JSON files (output of translate.py) into the database.

No Ordbokene parsing logic lives here — translate.py is the single source of
truth for the wire format. This module only does direct DB inserts from the
lemma JSON shape.
"""

import logging
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from flyt.apps.lexicons.schemas import normalize_example

logger = logging.getLogger(__name__)

# translate.py normalises POS tags to uppercase before emitting lemma JSON.
POS_MAP = {
    "NOUN": "noun",
    "VERB": "verb",
    "ADJ": "adjective",
    "ADV": "adverb",
    "PREP": "preposition",
    "CONJ": "conjunction",
    "PRON": "pronoun",
    "DET": "determiner",
    "INTERJ": "interjection",
    "NUM": "numeral",
}


async def get_article_lemmas(db: AsyncSession, article_id: int) -> list[Lemma]:
    result = await db.scalars(
        select(Lemma).where(Lemma.source_article_id == article_id).order_by(Lemma.id)
    )
    return list(result)


def _hgno(ld: dict) -> int:
    v = ld.get("hgno")
    return v if v is not None else 1


def _dedup_key(ld: dict) -> object:
    """Within-article identity: source_lemma_id (unique per article).

    Matches the lexicon_lemmas (source_article_id, source_lemma_id) unique
    constraint and the update path's by_source_id matching. Keying on
    (word, pos, hgno) as before collapsed distinct senses that share those (e.g.
    legg "fold" vs "setting hair", both NOUN hgno 3). When source_lemma_id is
    absent, fall back to (word, pos, hgno) so id-less lemmas still de-dup.
    """
    source_lemma_id = ld.get("source_lemma_id")
    if source_lemma_id is not None:
        return source_lemma_id
    return ("_noid", ld["lemma"], POS_MAP.get(ld["pos"], "unknown"), _hgno(ld))


def _first_pron(pronunciations: list[dict]) -> dict | None:
    """Return the first pronunciation entry, or None."""
    return pronunciations[0] if pronunciations else None


def _lemma_base_pron(ld: dict) -> dict | None:
    """Find pronunciation for the base form (word_form == lemma word)."""
    lemma_word = ld.get("lemma", "")
    for wf in ld.get("word_forms", []):
        if wf.get("word_form") == lemma_word:
            return _first_pron(wf.get("pronunciation") or [])
    return None


def _pron_is_approximate(pron: dict | None) -> bool:
    """True when pronunciation is model-generated (nb_g2p) rather than lexicon-backed."""
    if pron is None:
        return False
    return bool(pron.get("needs_review")) or pron.get("source") == "nb_g2p"


def _is_safe_audio_url(url: str) -> bool:
    """Accept only a well-formed absolute https URL with a host. The raw value is
    persisted and later used as an audio ``src``, so also reject traversal and
    (encoded) control characters that urlparse would otherwise tolerate."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False  # malformed URL (e.g. bad IPv6 literal) — reject, don't crash
    if parsed.scheme != "https" or not parsed.netloc:
        return False
    lowered = url.lower()
    return (
        ".." not in url
        and not any(c.isspace() for c in url)
        and "\x00" not in url
        and not any(
            seq in lowered for seq in ("%00", "%0d", "%0a")
        )  # encoded null/CR/LF
    )


def _lemma_audio_url(ld: dict) -> str | None:
    # The lemma data ships the absolute, already-hosted audio URL.
    entries = ld.get("audio", {}).get("lemma", [])
    if not entries:
        return None
    url = entries[0].get("url")
    if isinstance(url, str) and _is_safe_audio_url(url):
        return url
    return None


def _apply_lemma_fields(
    lemma: Lemma,
    ld: dict,
    article_id: int,
    cross_reference_article_id: int | None,
    cross_reference_word: str | None,
) -> None:
    lemma.word = ld["lemma"]
    lemma.pos = LemmaPos(POS_MAP.get(ld["pos"], "unknown"))
    lemma.hgno = _hgno(ld)
    lemma.is_sub_article = ld["is_sub_article"]
    lemma.primary_translation = ld.get("primary_translation")
    lemma.source_lemma_id = ld.get("source_lemma_id")
    lemma.cross_reference_article_id = cross_reference_article_id
    lemma.cross_reference_word = cross_reference_word
    pron = _lemma_base_pron(ld)
    tone = pron.get("tone") if pron else None
    lemma.ipa = pron.get("ipa") if pron else None
    lemma.intonation = str(tone) if tone in (1, 2) else None
    lemma.ipa_approximate = _pron_is_approximate(pron)
    lemma.audio_url = _lemma_audio_url(ld)
    raw_rank = ld.get("frequency_rank")
    if raw_rank is not None and not isinstance(raw_rank, int):
        raise ValueError(
            f"Article {article_id}: frequency_rank must be int or null, got {raw_rank!r}"
        )
    lemma.frequency_rank = raw_rank
    lemma.frequency_ambiguous = bool(ld.get("frequency_ambiguous"))


def _is_translated_definition(defn: dict) -> bool:
    """A definition is importable only when it carries both the Norwegian
    ``text`` and an English ``translation``. Untranslated senses are dropped,
    not treated as fatal — the source data legitimately contains ~8% of them.
    """
    text = defn.get("text")
    translation = defn.get("translation")
    return (
        isinstance(text, str)
        and bool(text.strip())
        and isinstance(translation, str)
        and bool(translation.strip())
    )


def _translated_definitions(definitions: list[dict]) -> list[dict]:
    return [defn for defn in definitions if _is_translated_definition(defn)]


def _lemma_is_importable(ld: dict, *, has_translated_def: bool) -> bool:
    """Import a lemma only when it can produce a usable vocabulary card:
    a non-empty ``primary_translation`` AND at least one translated definition.

    Cross-reference redirects grant no exemption — a lemma with no translated
    definition is a navigation alias, not a learnable card, and is skipped.
    """
    primary = ld.get("primary_translation")
    return isinstance(primary, str) and bool(primary.strip()) and has_translated_def


def _add_word_forms(db: AsyncSession, lemma: Lemma, ld: dict) -> None:
    for wf in ld.get("word_forms", []):
        pron = _first_pron(wf.get("pronunciation") or [])
        db.add(
            WordForm(
                lemma_id=lemma.id,
                form=wf["word_form"],
                tags_json=wf["tags_json"],
                ipa=pron.get("ipa") if pron else None,
                ipa_approximate=_pron_is_approximate(pron),
                # audio_url intentionally omitted: per-form audio not yet in NorskLexicon source data
            )
        )


def _add_definitions(db: AsyncSession, lemma: Lemma, definitions: list[dict]) -> None:
    # Two-pass: validate + normalize ALL examples before any db.add, so a bad
    # example (TypeError) fails before the session is mutated — no partial
    # write in the update path where child rows are already deleted.
    prepared: list[tuple[dict, list[dict]]] = []
    for defn in definitions:
        normalized: list[dict] = []
        for ex in defn.get("examples", []):
            if not isinstance(ex, dict):
                raise TypeError(
                    f"example must be a {{no, en}} dict, got {type(ex).__name__}: {ex!r}"
                )
            pair = normalize_example(ex)
            if pair is not None:
                normalized.append(pair.model_dump())
        prepared.append((defn, normalized))

    for defn, normalized in prepared:
        db.add(
            Definition(
                lemma_id=lemma.id,
                definition=defn["text"],
                examples_json=normalized,
                translation=defn["translation"],
                translation_source="ordbokene_translation",
            )
        )


def _add_see_also(db: AsyncSession, lemma: Lemma, see_also_list: list[dict]) -> None:
    """Insert see-also rows for the lemma, ordered by ordinal (export order).

    Caller is responsible for deleting existing rows on the update path before
    calling this, mirroring ``_add_definitions``.
    """
    for ordinal, entry in enumerate(see_also_list):
        db.add(
            SeeAlso(
                lemma_id=lemma.id,
                target_article_id=entry["article_id"],
                target_word=entry["lemma"],
                relation=entry["relation"],
                ordinal=ordinal,
            )
        )


async def import_article(db: AsyncSession, data: dict) -> list[Lemma]:
    article_id = data["source_article_id"]
    if not data.get("lemmas"):
        return []
    cross_ref = data.get("cross_reference") or {}
    cross_reference_article_id = cross_ref.get("article_id")
    cross_reference_word = cross_ref.get("lemma")
    good_defs = _translated_definitions(data.get("definitions", []))
    has_translated_def = bool(good_defs)
    see_also = data.get("see_also") or []
    lemmas: list[Lemma] = []
    seen: set[object] = set()
    skipped = 0

    for ld in data["lemmas"]:
        key = _dedup_key(ld)
        if key in seen:
            continue
        seen.add(key)
        if not _lemma_is_importable(ld, has_translated_def=has_translated_def):
            skipped += 1
            continue
        lemma = Lemma(source_article_id=article_id)
        _apply_lemma_fields(
            lemma,
            ld,
            article_id,
            cross_reference_article_id,
            cross_reference_word,
        )
        db.add(lemma)
        await db.flush()
        _add_word_forms(db, lemma, ld)
        _add_definitions(db, lemma, good_defs)
        _add_see_also(db, lemma, see_also)
        lemmas.append(lemma)

    if skipped:
        logger.info(
            "Article %s: skipped %s lemma(s) lacking primary translation "
            "or a translated definition",
            article_id,
            skipped,
        )
    await db.flush()
    return lemmas


async def update_article(
    db: AsyncSession,
    data: dict,
    existing_lemmas: list[Lemma],
) -> list[Lemma]:
    """Update existing lemma rows in-place, replacing their word_forms and definitions.

    Preserves lemma primary keys so flashcard_card_pools FK references remain valid.
    Lemmas in data that have no source_lemma_id match in existing_lemmas are inserted fresh.
    """
    article_id = data["source_article_id"]
    if not data.get("lemmas"):
        return []
    cross_ref = data.get("cross_reference") or {}
    cross_reference_article_id = cross_ref.get("article_id")
    cross_reference_word = cross_ref.get("lemma")
    good_defs = _translated_definitions(data.get("definitions", []))
    has_translated_def = bool(good_defs)
    see_also = data.get("see_also") or []

    by_source_id: dict[int | None, Lemma] = {
        lem.source_lemma_id: lem for lem in existing_lemmas
    }
    updated: list[Lemma] = []
    seen: set[object] = set()
    skipped = 0

    for ld in data["lemmas"]:
        key = _dedup_key(ld)
        if key in seen:
            continue
        seen.add(key)
        # Skip a no-longer-importable payload lemma wholesale: an existing row
        # is left untouched (never deleted/degraded), a fresh one is not created.
        if not _lemma_is_importable(ld, has_translated_def=has_translated_def):
            skipped += 1
            continue
        source_lemma_id = ld.get("source_lemma_id")
        existing = by_source_id.get(source_lemma_id)

        if existing:
            _apply_lemma_fields(
                existing,
                ld,
                article_id,
                cross_reference_article_id,
                cross_reference_word,
            )
            for wf in list(existing.word_forms):
                await db.delete(wf)
            for defn in list(existing.definitions):
                await db.delete(defn)
            for sa in list(existing.see_also):
                await db.delete(sa)
            await db.flush()
            lemma = existing
        else:
            lemma = Lemma(source_article_id=article_id)
            _apply_lemma_fields(
                lemma,
                ld,
                article_id,
                cross_reference_article_id,
                cross_reference_word,
            )
            db.add(lemma)
            await db.flush()

        _add_word_forms(db, lemma, ld)
        _add_definitions(db, lemma, good_defs)
        _add_see_also(db, lemma, see_also)
        updated.append(lemma)

    if skipped:
        logger.info(
            "Article %s: skipped %s lemma(s) lacking primary translation "
            "or a translated definition",
            article_id,
            skipped,
        )
    await db.flush()
    return updated
