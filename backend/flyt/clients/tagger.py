"""flyt-tagger morphological client (the service's source lives in morph-svc/).

On a WordForm miss, resolve_word asks the tagger to deinflect/decompound a
surface form into candidate base lemmas. Fail-open: never raises. Caching is
the tagger service's job, not this client's.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from http import HTTPStatus
import logging
from typing import Any

import httpx

from flyt.core.config import settings

logger = logging.getLogger(__name__)

_OBT_POS_TO_LEMMA_POS: dict[str, str] = {
    "subst": "noun",
    "verb": "verb",
    "adj": "adjective",
    "adv": "adverb",
    "prep": "preposition",
    "konj": "conjunction",
    "pron": "pronoun",
    "det": "determiner",
    "interj": "interjection",
    "kardinal": "numeral",
}


def _normalize_obt_pos(raw_pos: str | None) -> str | None:
    if not raw_pos:
        return None
    return _OBT_POS_TO_LEMMA_POS.get(raw_pos.lower())


@dataclass(frozen=True)
class TaggerCandidate:
    lemma: str
    is_compound: bool
    pos: str | None = None


def _derive_tagger_candidate(
    word: str,
    analyses: list[Any],
) -> list[TaggerCandidate]:
    word_lower = word.lower()
    candidates: list[TaggerCandidate] = []
    seen: set[tuple[str, str | None]] = set()

    for analysis in analyses:
        if not isinstance(analysis, dict):
            continue

        normalized_pos = _normalize_obt_pos(
            str(analysis.get("pos")) if analysis.get("pos") is not None else None
        )

        if (
            analysis.get("is_compound") is True
            and analysis.get("head")
            and str(analysis["head"]).lower() != word_lower
        ):
            head_lower = str(analysis["head"]).lower()
            key = (head_lower, normalized_pos)
            if key not in seen:
                seen.add(key)
                candidates.append(
                    TaggerCandidate(
                        lemma=str(analysis["head"]),
                        is_compound=True,
                        pos=normalized_pos,
                    )
                )
            continue

        lemma = analysis.get("lemma")
        if lemma and str(lemma).lower() != word_lower:
            lemma_lower = str(lemma).lower()
            key = (lemma_lower, normalized_pos)
            if key not in seen:
                seen.add(key)
                candidates.append(
                    TaggerCandidate(
                        lemma=str(lemma),
                        is_compound=bool(analysis.get("is_compound", False)),
                        pos=normalized_pos,
                    )
                )

    return candidates


@asynccontextmanager
async def open_session() -> AsyncIterator[httpx.AsyncClient]:
    """Yield one reusable client for a batch of tagger requests.

    The client is closed on all exit paths. Callers branch on
    ``settings.TAGGER_SVC_URL`` before opening a session; the tagger is
    optional.
    """
    async with httpx.AsyncClient(
        timeout=settings.TAGGER_SVC_TIMEOUT_SECONDS,
    ) as client:
        yield client


async def analyze(
    client: httpx.AsyncClient,
    word: str,
) -> list[TaggerCandidate]:
    """Analyze one word over *client*, failing open to no candidates."""
    svc_url = settings.TAGGER_SVC_URL
    try:
        response = await client.post(
            f"{svc_url}/analyze",
            json={"word": word},
        )

        if response.status_code != HTTPStatus.OK:
            logger.info(
                "[tagger-fallback] flyt-tagger returned %s for %r; failing open",
                response.status_code,
                word,
            )
            return []

        payload = response.json()
        analyses = payload.get("analyses") if isinstance(payload, dict) else None
        if not isinstance(analyses, list):
            return []
        return _derive_tagger_candidate(word, analyses)
    except (httpx.HTTPError, ValueError) as exc:
        logger.info(
            "[tagger-fallback] flyt-tagger call failed for %r: %s; failing open",
            word,
            exc,
        )
        return []
