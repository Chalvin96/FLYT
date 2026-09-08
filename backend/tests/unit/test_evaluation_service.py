"""Generic provider-backed evaluation contract tests."""

import json

import pytest

from flyt.apps.lessons.exceptions import ExerciseResponseInvalidError
from flyt.apps.lessons.runtime_service import validate_write_response_or_raise
from flyt.content.schemas import WritePayload
from flyt.evaluation.service import EvaluationCase
from flyt.evaluation.service import EvaluationCriterion
from flyt.evaluation.service import EvaluationUnavailableError
from flyt.evaluation.service import build_evaluation_request
from flyt.evaluation.service import parse_criterion_verdicts_or_raise
from tests.helpers.lesson_packets import exercise_for

CRITERIA = (
    EvaluationCriterion(id="c1", instruction="Bruker presens."),
    EvaluationCriterion(id="c2", instruction="Nevner et tidspunkt."),
)


def write_payload() -> WritePayload:
    exercise = exercise_for("write")
    exercise["payload"]["criteria"] = [
        {"id": criterion.id, "instruction": criterion.instruction}
        for criterion in CRITERIA
    ]
    return WritePayload.model_validate(exercise["payload"])


def evaluation_case() -> EvaluationCase:
    return EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe your morning.",
        response="Jeg står opp klokka sju.",
        criteria=CRITERIA,
    )


def verdicts_body(*entries: dict) -> str:
    return json.dumps({"criteria": list(entries)})


def test_parse_evaluation_verdicts_given_fenced_json_expect_verdicts() -> None:
    text = (
        "```json\n"
        + verdicts_body(
            {"criterion_id": "c1", "met": True, "evidence": "skriver"},
            {"criterion_id": "c2", "met": False, "evidence": None},
        )
        + "\n```"
    )

    verdicts = parse_criterion_verdicts_or_raise(text, CRITERIA)

    assert [
        (verdict.criterion_id, verdict.met, verdict.evidence) for verdict in verdicts
    ] == [("c1", True, "skriver"), ("c2", False, None)]


@pytest.mark.parametrize(
    "text",
    [
        verdicts_body(
            {"criterion_id": "ghost", "met": True, "evidence": None},
            {"criterion_id": "c2", "met": True, "evidence": None},
        ),
        verdicts_body({"criterion_id": "c1", "met": True, "evidence": None}),
        verdicts_body(
            {"criterion_id": "c1", "met": True, "evidence": None},
            {"criterion_id": "c1", "met": False, "evidence": None},
        ),
        verdicts_body(
            {"criterion_id": "c1", "met": 1, "evidence": None},
            {"criterion_id": "c2", "met": True, "evidence": None},
        ),
        verdicts_body(
            {"criterion_id": "c1", "met": True, "evidence": "x" * 1001},
            {"criterion_id": "c2", "met": True, "evidence": None},
        ),
        "Looks good overall.",
    ],
)
def test_parse_evaluation_verdicts_given_invalid_output_expect_unavailable(
    text: str,
) -> None:
    with pytest.raises(EvaluationUnavailableError):
        parse_criterion_verdicts_or_raise(text, CRITERIA)


def test_build_evaluation_request_given_case_expect_private_instructions_and_criteria() -> (
    None
):
    request = build_evaluation_request(evaluation_case())

    assert "Judge the paragraph." in request.instructions
    assert "JSON" in request.instructions
    assert "- c1: Bruker presens." in request.prompt
    assert "- c2: Nevner et tidspunkt." in request.prompt
    assert "Jeg står opp klokka sju." in request.prompt


@pytest.mark.parametrize(
    ("mutator", "message"),
    [
        (lambda payload: setattr(payload, "min_words", 5), "at least 5 words"),
        (
            lambda payload: setattr(payload, "response_language", "en"),
            "judged in its authored",
        ),
    ],
)
def test_validate_write_response_given_invalid_payload_expect_rejection(
    mutator, message: str
) -> None:
    payload = write_payload()
    mutator(payload)

    with pytest.raises(ExerciseResponseInvalidError, match=message):
        validate_write_response_or_raise(payload, "For kort.")


def test_validate_write_response_given_above_maximum_expect_rejection() -> None:
    payload = write_payload()
    payload.min_words = None
    payload.max_words = 3

    with pytest.raises(ExerciseResponseInvalidError, match="no more than 3 words"):
        validate_write_response_or_raise(payload, "Jeg skriver en kort tekst nå.")


def test_validate_write_response_given_minimum_met_expect_acceptance() -> None:
    payload = write_payload()
    payload.min_words = 5

    validate_write_response_or_raise(payload, "Jeg skriver en kort tekst nå.")
