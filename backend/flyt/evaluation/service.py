"""Provider-backed evaluation of a response against explicit criteria."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass

from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderFailure

K_MAX_EVALUATION_EVIDENCE_CHARS = 1000
K_SYSTEM_EVIDENCE_HEADER = (
    "--- SYSTEM EVIDENCE (trusted, computed from the learner response) ---"
)
K_WORD_CHARACTER_CATEGORY_PREFIXES = frozenset(("L", "N"))
K_SENTENCE_TERMINATORS = frozenset(".!?…")
K_SENTENCE_CLOSING_QUOTES = frozenset(
    ("«", "»", '"', "'", "\u2019", "\u201d", "\u2018", ")", "]")
)
K_SENTENCE_ABBREVIATIONS = frozenset(
    ("nr", "f.eks", "f", "eks", "kl", "osv", "bl.a", "dr", "prof")
)
K_MODAL_CONSTRUCTION_RE = re.compile(
    r"\b(skulle|burde|ville|kunne|kan|måtte)( ikke)? ha\b",
    re.IGNORECASE,
)
K_NORWEGIAN_WORD_PATTERN = r"[A-Za-zÆØÅæøå]+"
K_CONSTRUCTION_DISTRIBUTION_CRITERION_ID = "construction-distribution"

_RESPONSE_FORMAT = (
    "Reply with ONLY a JSON object of the exact shape "
    '{"criteria": [{"criterion_id": "<id>", "met": true, '
    '"evidence": "<short quote from the response, or null>"}]}. '
    "Return exactly one entry for every criterion id, using each id once. "
    '"met" must be a boolean. Output no other text.'
)

_JSON_FENCE_RE = re.compile(r"^```[a-z]*\s*|\s*```$")


@dataclass(frozen=True)
class EvaluationCriterion:
    id: str
    instruction: str


@dataclass(frozen=True)
class EvaluationCase:
    instructions: str
    task: str
    response: str
    criteria: tuple[EvaluationCriterion, ...]


@dataclass(frozen=True)
class CriterionVerdict:
    criterion_id: str
    met: bool
    evidence: str | None


class EvaluationUnavailableError(RuntimeError):
    """The provider or its response could not produce a safe evaluation."""

    def __init__(self, message: str = "Evaluation is temporarily unavailable"):
        super().__init__(message)


def count_norwegian_words(text: str) -> int:
    """Count whitespace tokens containing at least one letter or numeral."""
    return sum(
        any(
            unicodedata.category(character)[0] in K_WORD_CHARACTER_CATEGORY_PREFIXES
            for character in token
        )
        for token in text.split()
    )


def build_evaluation_request(case: EvaluationCase) -> GenerationRequest:
    criteria_lines = "\n".join(
        f"- {criterion.id}: {criterion.instruction}" for criterion in case.criteria
    )
    response = case.response.strip()
    sentences = _split_response_sentences(response)
    word_count = count_norwegian_words(response)
    constructions: dict[str, tuple[str, bool]] = {}
    for criterion in case.criteria:
        for match in K_MODAL_CONSTRUCTION_RE.finditer(criterion.instruction):
            modal = match.group(1).casefold()
            has_ikke = match.group(2) is not None
            construction = f"{modal}{' ikke' if has_ikke else ''} ha"
            constructions.setdefault(construction, (modal, has_ikke))

    construction_patterns: dict[str, str] = {}
    for construction, (modal, has_ikke) in constructions.items():
        if has_ikke:
            construction_patterns[construction] = (
                rf"\b{re.escape(modal)}"
                rf"(?:\s+(?!ikke\b){K_NORWEGIAN_WORD_PATTERN}){{0,3}}\s+ikke"
                rf"(?:\s+(?!ha\b){K_NORWEGIAN_WORD_PATTERN})?\s+ha\b"
            )
        else:
            construction_patterns[construction] = (
                rf"\b{re.escape(modal)}"
                rf"(?:\s+(?!ikke\b){K_NORWEGIAN_WORD_PATTERN}){{0,3}}\s+ha\b"
            )

    response_construction_matches = {
        construction: list(re.finditer(response_pattern, response, re.IGNORECASE))
        for construction, response_pattern in construction_patterns.items()
    }
    construction_evidence_lines = []
    for construction, matches in response_construction_matches.items():
        quoted_spans = ", ".join(
            json.dumps(match.group(0), ensure_ascii=False) for match in matches[:5]
        )
        construction_evidence_lines.append(
            f"Construction <{construction}>: {len(matches)} occurrence(s): "
            f"{quoted_spans or 'none'}"
            " Verify the past participle yourself."
        )

    if construction_patterns and any(
        criterion.id == K_CONSTRUCTION_DISTRIBUTION_CRITERION_ID
        for criterion in case.criteria
    ):
        per_sentence: list[dict[str, int]] = []
        for sentence_number, sentence in enumerate(sentences, start=1):
            counts = {
                construction: len(list(re.finditer(pattern, sentence, re.IGNORECASE)))
                for construction, pattern in construction_patterns.items()
            }
            per_sentence.append(counts)
            construction_evidence_lines.append(
                f"Sentence {sentence_number} constructions: "
                + ", ".join(
                    f"<{construction}>: {count}"
                    for construction, count in counts.items()
                )
            )
        outside_text = ", ".join(
            f"<{construction}>: {len(matches) - sum(counts[construction] for counts in per_sentence)}"
            for construction, matches in response_construction_matches.items()
            if len(matches) != sum(counts[construction] for counts in per_sentence)
        )
        if outside_text:
            construction_evidence_lines.append(
                "Occurrences outside a complete sentence "
                f"(excluded from per-sentence counts): {outside_text}"
            )

    construction_evidence = "".join(f"\n{line}" for line in construction_evidence_lines)
    return GenerationRequest(
        instructions=(
            f"Evaluate the learner response provided as the user message.\n\n"
            f"{case.instructions}\n\n"
            f"Criteria:\n{criteria_lines}\n\n"
            f"Task: {case.task.strip()}\n\n"
            f"{K_SYSTEM_EVIDENCE_HEADER}\n"
            f"Word count: {word_count} "
            "(rule: whitespace-separated tokens containing at least one letter or "
            "numeral)\n"
            f"Sentence count: {len(sentences)} "
            "(rule: sentences end with . ! ? or …)\n"
            "Evidence rule: Treat computed counts and construction occurrences as "
            "authoritative for matching criteria."
            f"{construction_evidence}\n\n"
            f"{_RESPONSE_FORMAT}"
        ),
        prompt=response,
        temperature=0,
    )


def parse_criterion_verdicts_or_raise(
    text: str,
    criteria: tuple[EvaluationCriterion, ...],
    *,
    max_evidence_chars: int = K_MAX_EVALUATION_EVIDENCE_CHARS,
) -> list[CriterionVerdict]:
    """Validate model JSON before returning any criterion verdicts."""
    known_ids = [criterion.id for criterion in criteria]
    try:
        body = json.loads(_JSON_FENCE_RE.sub("", text.strip()))
    except ValueError:
        raise EvaluationUnavailableError() from None
    entries = body.get("criteria") if isinstance(body, dict) else None
    if not isinstance(entries, list):
        raise EvaluationUnavailableError()

    verdicts: list[CriterionVerdict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise EvaluationUnavailableError()
        criterion_id = entry.get("criterion_id")
        met = entry.get("met")
        evidence = entry.get("evidence")
        if not isinstance(criterion_id, str) or criterion_id not in known_ids:
            raise EvaluationUnavailableError()
        if not isinstance(met, bool):
            raise EvaluationUnavailableError()
        if evidence is not None and (
            not isinstance(evidence, str) or len(evidence) > max_evidence_chars
        ):
            raise EvaluationUnavailableError()
        verdicts.append(
            CriterionVerdict(
                criterion_id=criterion_id,
                met=met,
                evidence=evidence,
            )
        )
    if sorted(verdict.criterion_id for verdict in verdicts) != sorted(known_ids):
        raise EvaluationUnavailableError()
    return verdicts


class EvaluationService:
    """Evaluate a case through an injected model provider.

    The service owns the provider request format and safe verdict parsing. The
    caller owns domain-specific response validation and maps its own criterion
    types to ``EvaluationCase``.
    """

    def __init__(
        self,
        provider: ModelProvider,
        *,
        max_evidence_chars: int = K_MAX_EVALUATION_EVIDENCE_CHARS,
    ) -> None:
        self.provider = provider
        self.max_evidence_chars = max_evidence_chars

    async def evaluate(
        self, user_id: int, case: EvaluationCase
    ) -> list[CriterionVerdict]:
        try:
            result = await self.provider.generate(
                user_id, build_evaluation_request(case)
            )
        except ProviderFailure as failure:
            raise EvaluationUnavailableError() from failure
        return parse_criterion_verdicts_or_raise(
            result.text,
            case.criteria,
            max_evidence_chars=self.max_evidence_chars,
        )


def _is_terminal_sentence_token(token: str) -> bool:
    stripped = token.rstrip("".join(sorted(K_SENTENCE_CLOSING_QUOTES)))
    if not stripped:
        return False
    if stripped.casefold().rstrip(".") in K_SENTENCE_ABBREVIATIONS:
        return False
    return stripped[-1] in K_SENTENCE_TERMINATORS


def _split_response_sentences(response: str) -> list[str]:
    closing_quotes = "".join(sorted(K_SENTENCE_CLOSING_QUOTES))
    sentences: list[str] = []
    current: list[str] = []
    tokens = response.split()
    index = 0
    while index < len(tokens):
        token = tokens[index]
        current.append(token)
        index += 1
        if not _is_terminal_sentence_token(token):
            continue
        while index < len(tokens) and not tokens[index].strip(closing_quotes):
            current.append(tokens[index])
            index += 1
        sentences.append(" ".join(current))
        current = []
    return sentences
