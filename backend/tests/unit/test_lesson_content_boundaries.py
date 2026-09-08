import json
from unittest.mock import AsyncMock

import pytest

from flyt.apps.lessons.exceptions import ExerciseResponseInvalidError
from flyt.apps.lessons.runtime_service import validate_write_response_or_raise
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.content.exceptions import LessonPacketError
from flyt.content.validation import parse_lesson_packet_or_raise
from flyt.content.schemas import WriteExercise
from flyt.evaluation.service import EvaluationCase
from flyt.evaluation.service import EvaluationCriterion
from flyt.evaluation.service import EvaluationService
from flyt.evaluation.service import EvaluationUnavailableError
from flyt.evaluation.service import build_evaluation_request
from flyt.evaluation.service import parse_criterion_verdicts_or_raise


def _write_exercise() -> WriteExercise:
    return WriteExercise.model_validate(
        {
            "kind": "exercise",
            "id": "write-1",
            "objective_id": "objective-1",
            "prompt": [{"kind": "text", "value": "Describe your morning."}],
            "explanation": [],
            "operation": "write",
            "payload": {
                "response_language": "no",
                "judge_prompt": "Assess the learner response.",
                "criteria": [
                    {"id": "c1", "instruction": "Use present tense."},
                    {"id": "c2", "instruction": "Mention a time."},
                ],
            },
        }
    )


def _evaluation_case(response: str) -> EvaluationCase:
    exercise = _write_exercise()
    return EvaluationCase(
        instructions=exercise.payload.judge_prompt,
        task="Describe your morning.",
        response=response,
        criteria=tuple(
            EvaluationCriterion(id=c.id, instruction=c.instruction)
            for c in exercise.payload.criteria
        ),
    )


def test_evaluation_request_given_generic_case_expect_private_policy_and_response() -> (
    None
):
    request = build_evaluation_request(_evaluation_case("Jeg står opp klokken sju."))

    assert "Assess the learner response." in request.instructions
    assert "c1: Use present tense." in request.prompt
    assert "Jeg står opp klokken sju." in request.prompt


def test_parse_criterion_verdicts_given_complete_json_expect_criterion_results() -> (
    None
):
    verdicts = parse_criterion_verdicts_or_raise(
        json.dumps(
            {
                "criteria": [
                    {"criterion_id": "c1", "met": True, "evidence": "står"},
                    {"criterion_id": "c2", "met": False, "evidence": None},
                ]
            }
        ),
        _evaluation_case("").criteria,
    )

    assert [(verdict.criterion_id, verdict.met) for verdict in verdicts] == [
        ("c1", True),
        ("c2", False),
    ]


@pytest.mark.parametrize(
    "body",
    [
        {"criteria": [{"criterion_id": "c1", "met": True}]},
        {
            "criteria": [
                {"criterion_id": "c1", "met": True},
                {"criterion_id": "c1", "met": False},
            ]
        },
        {"criteria": [{"criterion_id": "unknown", "met": True}]},
    ],
)
def test_parse_criterion_verdicts_given_invalid_coverage_expect_unavailable(
    body: dict,
) -> None:
    with pytest.raises(EvaluationUnavailableError):
        parse_criterion_verdicts_or_raise(
            json.dumps(body), _evaluation_case("").criteria
        )


@pytest.mark.anyio
async def test_evaluation_service_given_valid_provider_expect_generic_verdicts() -> (
    None
):
    provider = AsyncMock()
    provider.generate.return_value = GenerationResult(
        text=json.dumps(
            {
                "criteria": [
                    {"criterion_id": "c1", "met": True, "evidence": "står"},
                    {"criterion_id": "c2", "met": False, "evidence": None},
                ]
            }
        )
    )

    verdicts = await EvaluationService(provider).evaluate(
        7, _evaluation_case("Jeg står opp klokken sju.")
    )

    assert [(verdict.criterion_id, verdict.met) for verdict in verdicts] == [
        ("c1", True),
        ("c2", False),
    ]
    provider.generate.assert_awaited_once()


@pytest.mark.anyio
async def test_evaluation_service_given_provider_failure_expect_generic_error() -> None:
    provider = AsyncMock()
    provider.generate.side_effect = ProviderFailure(ProviderFailureClass.TIMEOUT)

    with pytest.raises(EvaluationUnavailableError):
        await EvaluationService(provider).evaluate(7, _evaluation_case("Svar"))


def test_validate_write_response_given_empty_response_expect_invalid_response() -> None:
    with pytest.raises(ExerciseResponseInvalidError):
        validate_write_response_or_raise(_write_exercise().payload, "   ")


def test_parse_lesson_packet_given_unknown_field_expect_packet_error() -> None:
    with pytest.raises(LessonPacketError):
        parse_lesson_packet_or_raise({"unexpected": True})
