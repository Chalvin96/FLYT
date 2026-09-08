"""Shared pagination and spaCy tokenization for the reading domain.

Pagination groups whole paragraphs (split on blank lines) until ~target words,
never splitting a paragraph. Tokenization uses spaCy's Norwegian model; offsets
are relative to the page slice. It is CPU-bound and synchronous, so callers run
``raw_tokens_batch`` in a thread; all page slices for one story are tokenized
through a single ``nlp.pipe`` call.
"""

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from typing import NamedTuple

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")


class RawToken(NamedTuple):
    text: str
    start: int
    end: int
    is_word: bool
    lemma: str
    pos: str


@dataclass(frozen=True)
class PageData:
    """One paginated, annotated page, before it is persisted.

    The shared unit produced by :func:`flyt.apps.reading.annotation.build_pages` and
    consumed by both the curated worker and the import worker. Callers persist
    the result inline on ``StoryPage.text_annotations_json``.
    """

    index: int
    content: str
    tokens: list[dict[str, Any]]
    word_count: int


def paginate(content: str, target_words: int) -> list[str]:
    """Group paragraphs into pages of roughly `target_words` words each."""
    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT.split(content) if p.strip()]
    pages: list[str] = []
    current: list[str] = []
    current_words = 0
    for paragraph in paragraphs:
        words = len(paragraph.split())
        if current and current_words + words > target_words:
            pages.append("\n\n".join(current))
            current, current_words = [], 0
        current.append(paragraph)
        current_words += words
    if current:
        pages.append("\n\n".join(current))
    return pages or [content.strip()]


@lru_cache(maxsize=1)
def tokenizer() -> Any:
    import spacy

    try:
        return spacy.load("nb_core_news_md", exclude=["parser", "ner"])
    except OSError as exc:
        raise RuntimeError(
            "spaCy model 'nb_core_news_md' is not installed. "
            "Install it with `uv run python -m spacy download nb_core_news_md`."
        ) from exc


def raw_tokens_batch(contents: list[str]) -> list[list[RawToken]]:
    """Tokenize all page strings through one ``nlp.pipe`` call.

    Each input becomes an independent spaCy Doc, so character offsets remain
    relative to its own page and page-local resolution order is unchanged.
    """
    return [_doc_to_raw_tokens(doc) for doc in tokenizer().pipe(contents)]


def _doc_to_raw_tokens(doc: Any) -> list[RawToken]:
    return [
        RawToken(
            text=token.text,
            start=token.idx,
            end=token.idx + len(token.text),
            is_word=token.is_alpha,
            lemma=token.lemma_.lower() if token.lemma_ else token.text.lower(),
            pos=token.pos_,
        )
        for token in doc
        if token.text.strip()
    ]
