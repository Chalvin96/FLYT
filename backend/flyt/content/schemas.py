"""Strict lesson packet content contract.

Mirrors the producer handoff and keeps packet validation independent of storage
and HTTP concerns.
Every model forbids extra fields; removed v3 operations and authoring-internal
fields are rejected instead of normalized.
"""

from __future__ import annotations
from collections.abc import Iterable

import re
from pathlib import PurePosixPath
from pathlib import PureWindowsPath
from typing import Annotated
from typing import Literal
from typing import Self
from urllib.parse import urlsplit

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import StrictInt
from pydantic import field_validator
from pydantic import model_validator


K_LESSON_PACKET_SCHEMA_VERSION: Literal["4.0"] = "4.0"
K_LESSON_LANGUAGE: Literal["nb-NO"] = "nb-NO"
K_LESSON_TRANSLATION_LANGUAGE: Literal["en"] = "en"

LessonKind = Literal[
    "grammar", "phraseology", "communicative", "pronunciation", "writing"
]
SectionRole = Literal["orient", "model", "contrast", "recap"]
CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
AudioStatus = Literal["synthesized"]
Operation = Literal[
    "choose",
    "recall_fill",
    "match_pairs",
    "build",
    "judge",
    "find_fix",
    "categorize",
    "speak",
    "write",
]

K_REMOVED_OPERATIONS = frozenset({"order"})
K_AUDIO_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
K_AUDIO_PATH_RE = re.compile(
    r"^audio/lessons/(?P<packet_id>[^/]+)/"
    r"(?P<uuid>[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12})\.wav$"
)
K_REQUEST_NOTE_ANCHOR_RE = re.compile(
    r"^(?:practice[\s_-]?request|request)\s*:", re.IGNORECASE
)
K_CONTROL_CHARACTER_LIMIT = 32


class _Wire(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── Inline spans ─────────────────────────────────────────────────────────


class TextSpan(_Wire):
    kind: Literal["text"]
    value: str


class EmphasisSpan(_Wire):
    kind: Literal["emphasis"]
    value: str


class StrongSpan(_Wire):
    kind: Literal["strong"]
    value: str


class CodeSpan(_Wire):
    kind: Literal["code"]
    value: str


class ForeignTermSpan(_Wire):
    kind: Literal["foreign_term"]
    value: str
    lang: Literal["no", "en"]


Span = Annotated[
    TextSpan | EmphasisSpan | StrongSpan | CodeSpan | ForeignTermSpan,
    Field(discriminator="kind"),
]
Spans = list[Span]


# ── Blocks ───────────────────────────────────────────────────────────────


class HeadingBlock(_Wire):
    kind: Literal["heading"]
    id: str
    level: Literal[3, 4]
    spans: Spans


class ParagraphBlock(_Wire):
    kind: Literal["paragraph"]
    id: str
    spans: Spans


class ReadingBlock(_Wire):
    kind: Literal["reading"]
    id: str
    spans: Spans
    translation: str = Field(min_length=1)
    speaker_id: str | None = None
    speaker_name: str | None = None
    dialogue_id: str | None = None
    turn_index: int | None = Field(default=None, ge=1)
    speaker_icon_url: str | None = None
    audio_id: str | None = None


class ListBlock(_Wire):
    kind: Literal["list"]
    id: str
    ordered: bool
    items: list[Spans]


class RuleBlock(_Wire):
    kind: Literal["rule"]
    id: str
    statement: Spans


class ExampleBlock(_Wire):
    kind: Literal["example"]
    id: str
    no: Spans
    en: Spans
    audio_id: str | None = None


class ExampleItem(_Wire):
    id: str
    no: Spans
    en: Spans
    audio_id: str | None = None


class ExamplesBlock(_Wire):
    kind: Literal["examples"]
    id: str
    items: list[ExampleItem]


class TableBlock(_Wire):
    kind: Literal["table"]
    id: str
    col_langs: list[Literal["no", "en"]]
    headers: list[Spans]
    rows: list[list[Spans]]

    @model_validator(mode="after")
    def columns_consistent(self) -> Self:
        width = len(self.col_langs)
        if len(self.headers) != width:
            raise ValueError("col_langs must match header count")
        for row in self.rows:
            if len(row) != width:
                raise ValueError("col_langs must match every row width")
        return self


class CalloutBlock(_Wire):
    kind: Literal["callout"]
    id: str
    level: Literal["tip", "warning", "note"]
    blocks: list[Block]


Block = Annotated[
    HeadingBlock
    | ParagraphBlock
    | ReadingBlock
    | ListBlock
    | RuleBlock
    | ExampleBlock
    | ExamplesBlock
    | TableBlock
    | CalloutBlock,
    Field(discriminator="kind"),
]
CalloutBlock.model_rebuild()


class SectionPacket(_Wire):
    kind: Literal["section"]
    id: str
    role: SectionRole
    title: str
    objective_ids: list[str]
    blocks: list[Block]


# ── Operation payloads ───────────────────────────────────────────────────


class _RecallSpanSegment(_Wire):
    kind: Literal["span"]
    spans: Spans


class _RecallBlankSegment(_Wire):
    kind: Literal["blank"]
    blank_id: str
    options: list[str] = Field(min_length=2)
    answer_index: int

    @model_validator(mode="after")
    def answer_in_range(self) -> Self:
        if not 0 <= self.answer_index < len(self.options):
            raise ValueError("answer_index out of range for options")
        return self


RecallFillSegment = Annotated[
    _RecallSpanSegment | _RecallBlankSegment, Field(discriminator="kind")
]


class RecallFillPayload(_Wire):
    segments: list[RecallFillSegment]

    @model_validator(mode="after")
    def blank_ids_unique(self) -> Self:
        duplicates = duplicate_values(
            segment.blank_id
            for segment in self.segments
            if isinstance(segment, _RecallBlankSegment)
        )
        if duplicates:
            raise ValueError(
                f"duplicate blank id {sorted(duplicates)[0]!r} in recall_fill"
            )
        return self


class ChooseOption(_Wire):
    option_id: str
    text: str
    why: str | None = None


class ChoosePayload(_Wire):
    options: list[ChooseOption] = Field(min_length=2)
    answer_id: str
    stem: Spans | None = None

    @model_validator(mode="after")
    def answer_exists(self) -> Self:
        if self.answer_id not in {option.option_id for option in self.options}:
            raise ValueError("answer_id must match an option_id")
        duplicates = duplicate_values(option.option_id for option in self.options)
        if duplicates:
            raise ValueError(f"duplicate option id {sorted(duplicates)[0]!r} in choose")
        return self


class MatchSideItem(_Wire):
    left_id: str
    text: str


class MatchRightItem(_Wire):
    right_id: str
    text: str


class MatchPair(_Wire):
    left_id: str
    right_id: str


class MatchPairsPayload(_Wire):
    left: list[MatchSideItem]
    right: list[MatchRightItem]
    pairs: list[MatchPair]

    @model_validator(mode="after")
    def pairs_reference_sides(self) -> Self:
        left_ids = {item.left_id for item in self.left}
        right_ids = {item.right_id for item in self.right}
        for pair in self.pairs:
            if pair.left_id not in left_ids:
                raise ValueError(f"pair references unknown left_id {pair.left_id!r}")
            if pair.right_id not in right_ids:
                raise ValueError(f"pair references unknown right_id {pair.right_id!r}")
        return self

    @model_validator(mode="after")
    def side_identities_unique(self) -> Self:
        duplicate_left = duplicate_values(item.left_id for item in self.left)
        duplicate_right = duplicate_values(item.right_id for item in self.right)
        if duplicate_left or duplicate_right:
            raise ValueError(
                "duplicate match side id "
                f"{sorted(duplicate_left | duplicate_right)[0]!r}"
            )
        # Sides may repeat across pairs (the producer emits many-to-one
        # links); only an exact duplicated relation is authoring noise.
        duplicate_pairs = duplicate_values(
            f"{pair.left_id}->{pair.right_id}" for pair in self.pairs
        )
        if duplicate_pairs:
            raise ValueError(f"duplicate match pairing {sorted(duplicate_pairs)[0]!r}")
        return self


class BuildToken(_Wire):
    token_id: str
    text: str
    fixed: bool


class BuildPayload(_Wire):
    tokens: list[BuildToken]
    answer_order: list[str]

    @model_validator(mode="after")
    def answer_covers_tokens(self) -> Self:
        duplicates = duplicate_values(t.token_id for t in self.tokens)
        if duplicates:
            raise ValueError(f"duplicate token id {sorted(duplicates)[0]!r} in build")
        if sorted(self.answer_order) != sorted(t.token_id for t in self.tokens):
            raise ValueError("answer_order must be a permutation of token_ids")
        return self


class JudgePayload(_Wire):
    sentence: Spans
    is_correct: bool
    feedback: str | None = None


class FindFixToken(_Wire):
    token_id: str
    text: str


class FindFixPayload(_Wire):
    tokens: list[FindFixToken]
    error_token_id: str
    feedback: str

    @model_validator(mode="after")
    def error_token_exists(self) -> Self:
        if self.error_token_id not in {t.token_id for t in self.tokens}:
            raise ValueError("error_token_id must match a token_id")
        duplicates = duplicate_values(t.token_id for t in self.tokens)
        if duplicates:
            raise ValueError(
                f"duplicate token id {sorted(duplicates)[0]!r} in find_fix"
            )
        return self


class CategorizeBucket(_Wire):
    bucket_id: str
    label: str


class CategorizeItem(_Wire):
    item_id: str
    text: str
    bucket_id: str


class CategorizePayload(_Wire):
    buckets: list[CategorizeBucket] = Field(min_length=2)
    items: list[CategorizeItem]

    @model_validator(mode="after")
    def items_reference_buckets(self) -> Self:
        ids = {bucket.bucket_id for bucket in self.buckets}
        for item in self.items:
            if item.bucket_id not in ids:
                raise ValueError(f"item {item.item_id!r} references unknown bucket")
        return self

    @model_validator(mode="after")
    def identities_unique(self) -> Self:
        duplicate_buckets = duplicate_values(
            bucket.bucket_id for bucket in self.buckets
        )
        duplicate_items = duplicate_values(item.item_id for item in self.items)
        if duplicate_buckets or duplicate_items:
            raise ValueError(
                "duplicate categorize id "
                f"{sorted(duplicate_buckets | duplicate_items)[0]!r}"
            )
        return self


class SpeakPayload(_Wire):
    target: str = Field(min_length=1)

    @field_validator("target")
    @classmethod
    def target_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("speak target must contain non-whitespace text")
        return value


class WriteCriterion(_Wire):
    id: str = Field(min_length=1)
    instruction: str = Field(min_length=1)


class WritePayload(_Wire):
    response_language: Literal["no"] = "no"
    min_words: int | None = Field(default=None, ge=1)
    max_words: int | None = Field(default=None, ge=1)
    judge_prompt: str = Field(min_length=1)
    criteria: list[WriteCriterion] = Field(min_length=1)

    @model_validator(mode="after")
    def word_bounds_ordered(self) -> Self:
        if (
            self.min_words is not None
            and self.max_words is not None
            and self.min_words > self.max_words
        ):
            raise ValueError("write min_words must not exceed max_words")
        duplicates = duplicate_values(criterion.id for criterion in self.criteria)
        if duplicates:
            raise ValueError(
                f"duplicate criterion id {sorted(duplicates)[0]!r} in write"
            )
        return self


# ── Exercises ────────────────────────────────────────────────────────────


class _ExerciseBase(_Wire):
    kind: Literal["exercise"]
    id: str
    objective_id: str
    prompt: Spans
    explanation: Spans | None
    audio_id: str | None = None


class ChooseExercise(_ExerciseBase):
    operation: Literal["choose"]
    payload: ChoosePayload


class RecallFillExercise(_ExerciseBase):
    operation: Literal["recall_fill"]
    payload: RecallFillPayload


class MatchPairsExercise(_ExerciseBase):
    operation: Literal["match_pairs"]
    payload: MatchPairsPayload


class BuildExercise(_ExerciseBase):
    operation: Literal["build"]
    payload: BuildPayload


class JudgeExercise(_ExerciseBase):
    operation: Literal["judge"]
    payload: JudgePayload


class FindFixExercise(_ExerciseBase):
    operation: Literal["find_fix"]
    payload: FindFixPayload


class CategorizeExercise(_ExerciseBase):
    operation: Literal["categorize"]
    payload: CategorizePayload


class SpeakExercise(_ExerciseBase):
    operation: Literal["speak"]
    payload: SpeakPayload


class WriteExercise(_ExerciseBase):
    operation: Literal["write"]
    payload: WritePayload


ExercisePacket = Annotated[
    ChooseExercise
    | RecallFillExercise
    | MatchPairsExercise
    | BuildExercise
    | JudgeExercise
    | FindFixExercise
    | CategorizeExercise
    | SpeakExercise
    | WriteExercise,
    Field(discriminator="operation"),
]


class SectionContentReference(_Wire):
    kind: Literal["section"]
    id: str


class ExerciseContentReference(_Wire):
    kind: Literal["exercise"]
    id: str


ContentReference = Annotated[
    SectionContentReference | ExerciseContentReference,
    Field(discriminator="kind"),
]


# ── Objectives, practice groups, media ───────────────────────────────────


class Objective(_Wire):
    id: str
    statement: str


class PracticeGroup(_Wire):
    id: str
    objective_id: str
    exercise_ids: list[str]


class AudioAsset(_Wire):
    id: str
    url: str
    mime: str
    path: str
    duration_ms: int | None = Field(default=None, ge=0)
    sha256: str | None = None
    status: AudioStatus

    @field_validator("url")
    @classmethod
    def url_is_absolute_https(cls, value: str) -> str:
        if (
            not value
            or value != value.strip()
            or any(
                ord(char) < K_CONTROL_CHARACTER_LIMIT or char.isspace()
                for char in value
            )
        ):
            raise ValueError("audio url must be an absolute HTTPS URL")
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("audio url must be an absolute HTTPS URL")
        return value

    @field_validator("path")
    @classmethod
    def path_is_safe_object_key(cls, value: str) -> str:
        if not _is_safe_audio_path(value):
            raise ValueError("audio path must be a safe host-free object key")
        if K_AUDIO_PATH_RE.fullmatch(value) is None:
            raise ValueError(
                "audio path must match audio/lessons/<packet-id>/<uuid>.wav"
            )
        return value

    @model_validator(mode="after")
    def url_matches_path(self) -> Self:
        if not urlsplit(self.url).path.endswith(f"/{self.path}"):
            raise ValueError("audio url must end with the exported audio path")
        return self

    @field_validator("sha256")
    @classmethod
    def sha256_is_bare_hex(cls, value: str | None) -> str | None:
        if value is not None and not K_AUDIO_SHA256_RE.fullmatch(value):
            raise ValueError("audio sha256 must be 64 lowercase hexadecimal characters")
        return value


class Media(_Wire):
    audio: list[AudioAsset]


# ── Packet and catalog ───────────────────────────────────────────────────


class LessonPacket(_Wire):
    schema_version: Literal["4.0"] = K_LESSON_PACKET_SCHEMA_VERSION
    id: str
    kind: LessonKind
    language: Literal["nb-NO"] = K_LESSON_LANGUAGE
    title: str
    cefr_level: CefrLevel
    goal: str
    objectives: list[Objective] = Field(min_length=1)
    content: list[ContentReference]
    sections: list[SectionPacket]
    exercises: list[ExercisePacket]
    practice_groups: list[PracticeGroup]
    media: Media

    @model_validator(mode="after")
    def audio_paths_match_packet(self) -> Self:
        prefix = f"audio/lessons/{self.id}/"
        for asset in self.media.audio:
            if not asset.path.startswith(prefix):
                raise ValueError(
                    f"audio path {asset.path!r} does not match packet id {self.id!r}"
                )
        return self


class LessonCatalogEntry(_Wire):
    lesson_id: str = Field(min_length=1)
    position: StrictInt = Field(ge=0)
    family_id: str | None = Field(default=None, min_length=1)


class LessonCatalog(_Wire):
    lessons: list[LessonCatalogEntry]


def duplicate_values(values: Iterable[str]) -> set[str]:
    seen: set[str] = set()
    duplicated: set[str] = set()
    for value in values:
        if value in seen:
            duplicated.add(value)
        seen.add(value)
    return duplicated


def _is_safe_audio_path(value: str) -> bool:
    posix_path = PurePosixPath(value)
    windows_path = PureWindowsPath(value)
    return bool(
        value
        and value == value.strip()
        and not posix_path.is_absolute()
        and not windows_path.is_absolute()
        and ".." not in posix_path.parts
        and ".." not in windows_path.parts
    )
