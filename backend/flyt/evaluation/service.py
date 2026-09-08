"""Provider-backed evaluation of a response against explicit criteria."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderFailure

K_MAX_EVALUATION_EVIDENCE_CHARS = 1000

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


def build_evaluation_request(case: EvaluationCase) -> GenerationRequest:
    criteria_lines = "\n".join(
        f"- {criterion.id}: {criterion.instruction}" for criterion in case.criteria
    )
    return GenerationRequest(
        instructions=f"{case.instructions}\n\n{_RESPONSE_FORMAT}",
        prompt=(
            f"Task: {case.task.strip()}\n"
            f"Criteria:\n{criteria_lines}\n\n"
            f"Response:\n{case.response.strip()}"
        ),
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
