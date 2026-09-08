from uuid import UUID

from pydantic import BaseModel
from pydantic import field_validator

from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.types import UserLemmaState


class WordFormRead(BaseModel):
    id: int
    form: str
    tags_json: list[str]
    ipa: str | None = None
    audio_url: str | None = None
    ipa_approximate: bool = False

    model_config = {"from_attributes": True}


class ExamplePair(BaseModel):
    """A bilingual example sentence: Norwegian source + optional English gloss.

    ``en`` is ``None`` when no translation is available yet. Empty/whitespace
    strings coerce to ``None`` at the model boundary so the wire contract stays
    honest (presence = real value) regardless of source.
    """

    no: str
    en: str | None = None

    @field_validator("en", mode="before")
    @classmethod
    def _normalize_en(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            return v.strip() or None
        return None


def normalize_example(x: dict) -> ExamplePair | None:
    """Normalize a ``{no, en}`` dict to an ``ExamplePair``.

    Schema-v3 source is always ``{no, en}``; the importer requires dicts and
    calls this. ``en == ""`` → ``None`` is handled by the ``ExamplePair.en``
    field validator. Returns ``None`` for entries with no ``no`` text (caller
    filters). Raises ``TypeError`` for a non-string, non-null ``en`` — fail
    fast at the import boundary rather than silently dropping the translation.
    """
    no = str(x.get("no") or "").strip()
    if not no:
        return None
    en = x.get("en")
    if en is not None and not isinstance(en, str):
        raise TypeError(
            f"example en must be a string or null, got {type(en).__name__}: {en!r}"
        )
    return ExamplePair(no=no, en=en)


class DefinitionRead(BaseModel):
    uuid: UUID
    id: int
    definition: str
    translation: str
    translation_source: str | None = None
    examples_json: list[ExamplePair]

    model_config = {"from_attributes": True}


class LemmaRead(BaseModel):
    uuid: UUID
    id: int
    source_article_id: int | None
    source_lemma_id: int | None
    word: str
    pos: LemmaPos
    hgno: int
    is_sub_article: bool
    primary_translation: str | None = None
    cross_reference_article_id: int | None = None
    word_forms: list[WordFormRead]
    definitions: list[DefinitionRead]

    model_config = {"from_attributes": True}


class LemmaDefinitionRead(BaseModel):
    uuid: UUID
    definition: str
    translation: str
    translation_source: str | None = None
    examples: list[ExamplePair]
    userState: UserLemmaState


class SeeAlsoRead(BaseModel):
    """A related-lemma link (se/sjå/jamfør pointer).

    ``target_lemma_uuid`` is ``None`` when the target article has not been
    imported yet (dangling pointer); ``word`` is still shown so the reader
    can look it up manually.
    """

    article_id: int
    word: str
    relation: str
    target_lemma_uuid: UUID | None = None


class LemmaSummaryRead(BaseModel):
    uuid: UUID
    word: str
    pos: LemmaPos
    primary_translation: str | None = None
    source_article_id: int | None = None
    source_lemma_id: int | None = None
    hgno: int | None = None
    is_sub_article: bool | None = None
    cross_reference_article_id: int | None = None
    see_also: list[SeeAlsoRead] = []
    ipa: str | None = None
    intonation: str | None = None
    ipa_approximate: bool = False
    audio_url: str | None = None


class LemmaDefinitionsResponse(BaseModel):
    lemma: LemmaSummaryRead
    definitions: list[LemmaDefinitionRead]


class UserLemmaRead(BaseModel):
    uuid: UUID
    word: str
    pos: LemmaPos
    primary_translation: str | None = None
    state: UserLemmaState


class UserLemmasResponse(BaseModel):
    lemmas: list[UserLemmaRead]
    learning_count: int
    mastered_count: int


class BrowseSuggestion(BaseModel):
    label: str


class BrowseSuggestionsResponse(BaseModel):
    suggestions: list[BrowseSuggestion]


class BrowseEntry(BaseModel):
    uuid: UUID
    hgno: int
    label: str


class BrowseHeadwordEntryResponse(BaseModel):
    headword: str
    entries: list[BrowseEntry]
    selected_lemma_uuid: UUID | None = None
    is_fallback: bool = False


class ResolveDefinition(BaseModel):
    definition: str
    translation: str


class ResolveCandidate(BaseModel):
    lemma_uuid: UUID
    word: str
    pos: LemmaPos
    hgno: int
    is_compound: bool = False
    definitions: list[ResolveDefinition]
    see_also: list[SeeAlsoRead] = []
    ipa: str | None = None
    intonation: str | None = None
    ipa_approximate: bool = False
    audio_url: str | None = None


class ResolveResponse(BaseModel):
    query: str
    candidates: list[ResolveCandidate]
