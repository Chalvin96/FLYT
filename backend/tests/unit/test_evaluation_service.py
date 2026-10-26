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
from flyt.evaluation.service import count_norwegian_words
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


K_EXPECTED_WORD_COUNT = 3


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
    assert "- c1: Bruker presens." in request.instructions
    assert "- c2: Nevner et tidspunkt." in request.instructions
    assert request.prompt == "Jeg står opp klokka sju."


def test_build_evaluation_request_given_mixed_tokens_expect_deterministic_word_count() -> (
    None
):
    case = evaluation_case()
    case = EvaluationCase(
        instructions=case.instructions,
        task=case.task,
        response="hei ,,, 123 e-post …",
        criteria=case.criteria,
    )

    request = build_evaluation_request(case)

    assert "Word count: 3" in request.instructions


def test_build_evaluation_request_given_semicolons_and_newlines_expect_terminal_sentence_count() -> (
    None
):
    case = evaluation_case()
    case = EvaluationCase(
        instructions=case.instructions,
        task=case.task,
        response="Først; fortsatt\nNeste…",
        criteria=case.criteria,
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 1" in request.instructions


def test_build_evaluation_request_given_case_expect_trusted_evidence_after_response() -> (
    None
):
    case = evaluation_case()
    case = EvaluationCase(
        instructions=case.instructions,
        task=case.task,
        response=case.response,
        criteria=(
            *case.criteria,
            EvaluationCriterion(
                id="c3", instruction="Bruk konstruksjonen burde ikke ha."
            ),
        ),
    )
    request = build_evaluation_request(case)

    assert request.prompt == case.response
    assert "Word count: 5" in request.instructions
    assert "Sentence count: 1" in request.instructions
    construction_line = "Construction <burde ikke ha>: 0 occurrence(s): none"
    assert construction_line in request.instructions
    assert construction_line not in request.prompt


def test_build_evaluation_request_given_intervening_word_expect_matched_span() -> None:
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Explain what should have happened.",
        response="Du burde du ha kontaktet resepsjonen.",
        criteria=(EvaluationCriterion(id="c1", instruction="Bruk BURDE HA."),),
    )

    request = build_evaluation_request(case)

    assert (
        'Construction <burde ha>: 1 occurrence(s): "burde du ha"'
        in request.instructions
    )


def test_build_evaluation_request_given_plain_and_ikke_expect_separate_counts() -> None:
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Explain what should have happened.",
        response="Jeg burde ha ringt, men jeg burde ikke ha ventet.",
        criteria=(
            EvaluationCriterion(id="c1", instruction="Bruk burde ha."),
            EvaluationCriterion(id="c2", instruction="Bruk burde ikke ha."),
        ),
    )

    request = build_evaluation_request(case)

    assert (
        'Construction <burde ha>: 1 occurrence(s): "burde ha"' in request.instructions
    )
    assert (
        'Construction <burde ikke ha>: 1 occurrence(s): "burde ikke ha"'
        in request.instructions
    )


def test_build_evaluation_request_given_missing_construction_expect_zero_listing() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Explain what should have happened.",
        response="Jeg ringte resepsjonen.",
        criteria=(EvaluationCriterion(id="c1", instruction="Bruk burde ikke ha."),),
    )

    request = build_evaluation_request(case)

    assert "Construction <burde ikke ha>: 0 occurrence(s): none" in request.instructions


def test_build_evaluation_request_given_six_matches_expect_five_distinct_spans() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Explain what should have happened.",
        response=(
            "burde du ha, burde aldri ha, burde kanskje ha, burde helst ha, "
            "burde også ha, burde faktisk ha"
        ),
        criteria=(
            EvaluationCriterion(id="c1", instruction="Bruk burde ha."),
            EvaluationCriterion(id="c2", instruction="Gjenta BURDE HA."),
        ),
    )

    request = build_evaluation_request(case)

    expected_line = (
        'Construction <burde ha>: 6 occurrence(s): "burde du ha", '
        '"burde aldri ha", "burde kanskje ha", "burde helst ha", "burde også ha"'
    )
    assert expected_line in request.instructions
    assert request.instructions.count("Construction <burde ha>:") == 1


def test_build_evaluation_request_given_case_expect_temperature_zero() -> None:
    request = build_evaluation_request(evaluation_case())

    assert request.temperature == 0


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


def test_build_evaluation_request_given_guillemet_wrapped_response_expect_terminal_sentence_count() -> (
    None
):
    case = evaluation_case()
    case = EvaluationCase(
        instructions=case.instructions,
        task=case.task,
        response="«Rom 204 skulle ha vært booket, men ble borte. Prosjektoren dukket aldri opp.»",
        criteria=case.criteria,
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 2" in request.instructions


def test_build_evaluation_request_given_adverb_before_ikke_expect_construction_counted() -> (
    None
):
    case = evaluation_case()
    case = EvaluationCase(
        instructions=case.instructions,
        task=case.task,
        response="Tidligere burde du ha spurt læreren. Spørsmål én burde du derimot ikke ha brukt så lang tid på.",
        criteria=(
            EvaluationCriterion(id="c1", instruction="Bruk burde ha og burde ikke ha."),
        ),
    )

    request = build_evaluation_request(case)

    assert (
        'Construction <burde ha>: 1 occurrence(s): "burde du ha"'
        in request.instructions
    )
    assert (
        'Construction <burde ikke ha>: 1 occurrence(s): "burde du derimot ikke ha"'
        in request.instructions
    )


def test_build_evaluation_request_given_abbreviation_expect_terminal_sentence_count() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe the room.",
        response=(
            "Rom nr. 204 skulle ha vært booket, men var opptatt. "
            "Prosjektoren skulle ha kommet, men uteble."
        ),
        criteria=CRITERIA,
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 2" in request.instructions


def test_build_evaluation_request_given_three_word_gap_expect_construction_counted() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Explain what should have happened.",
        response="Vi burde jo helt klart ha ringt.",
        criteria=(EvaluationCriterion(id="c1", instruction="Bruk burde ha."),),
    )

    request = build_evaluation_request(case)

    assert (
        'Construction <burde ha>: 1 occurrence(s): "burde jo helt klart ha"'
        in request.instructions
    )


def test_build_evaluation_request_given_constructions_in_one_sentence_expect_sentence_counts() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response=(
            "Rom 204 skulle ha vært booket og prosjektoren skulle ha kommet, "
            "men ingen av delene ble noe av. Det var en tung dag."
        ),
        criteria=(
            EvaluationCriterion(
                id="construction-distribution",
                instruction="Uses skulle ha twice, once in each sentence.",
            ),
        ),
    )

    request = build_evaluation_request(case)

    assert "Sentence 1 constructions: <skulle ha>: 2" in request.instructions
    assert "Sentence 2 constructions: <skulle ha>: 0" in request.instructions


def test_build_evaluation_request_given_one_sentence_distribution_expect_sentence_count() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response="Rommet skulle ha vært booket og prosjektoren skulle ha kommet.",
        criteria=(
            EvaluationCriterion(
                id="construction-distribution",
                instruction="Uses skulle ha twice, once in each sentence.",
            ),
        ),
    )

    request = build_evaluation_request(case)

    assert "Sentence 1 constructions: <skulle ha>: 2" in request.instructions
    assert "Sentence 2 constructions:" not in request.instructions


def test_build_evaluation_request_given_non_distribution_criterion_expect_no_sentence_counts() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response="Rommet skulle ha vært booket. Prosjektoren skulle ha kommet.",
        criteria=(EvaluationCriterion(id="form", instruction="Uses skulle ha twice."),),
    )

    request = build_evaluation_request(case)

    assert "Sentence 1 constructions:" not in request.instructions


def test_build_evaluation_request_given_quoted_abbreviation_expect_sentence_distribution() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response=(
            "«Rom nr. 204 skulle ha vært booket. Prosjektoren skulle ha kommet.»"
        ),
        criteria=(
            EvaluationCriterion(
                id="construction-distribution",
                instruction="Each sentence uses skulle ha once.",
            ),
        ),
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 2" in request.instructions
    assert "Sentence 1 constructions: <skulle ha>: 1" in request.instructions
    assert "Sentence 2 constructions: <skulle ha>: 1" in request.instructions


def test_build_evaluation_request_given_unterminated_tail_expect_no_extra_sentence() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response=(
            "Rommet skulle ha vært booket. Prosjektoren skulle ha kommet. "
            "Etterord uten terminator"
        ),
        criteria=(
            EvaluationCriterion(
                id="construction-distribution",
                instruction="Each sentence uses skulle ha once.",
            ),
        ),
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 2" in request.instructions
    assert "Sentence 1 constructions: <skulle ha>: 1" in request.instructions
    assert "Sentence 2 constructions: <skulle ha>: 1" in request.instructions
    assert "Sentence 3 constructions:" not in request.instructions
    assert "Occurrences outside a complete sentence" not in request.instructions


def test_build_evaluation_request_given_construction_in_unterminated_tail_expect_outside_note() -> (
    None
):
    case = EvaluationCase(
        instructions="Judge the paragraph.",
        task="Describe both arrangements.",
        response=(
            "Rommet skulle ha vært booket. Prosjektoren skulle ha kommet. "
            "Etterord skulle ha uten terminator"
        ),
        criteria=(
            EvaluationCriterion(
                id="construction-distribution",
                instruction="Each sentence uses skulle ha once.",
            ),
        ),
    )

    request = build_evaluation_request(case)

    assert "Sentence count: 2" in request.instructions
    assert "Sentence 1 constructions: <skulle ha>: 1" in request.instructions
    assert "Sentence 2 constructions: <skulle ha>: 1" in request.instructions
    assert "Sentence 3 constructions:" not in request.instructions
    assert (
        "Occurrences outside a complete sentence "
        "(excluded from per-sentence counts): <skulle ha>: 1" in request.instructions
    )


def test_count_norwegian_words_given_punctuation_only_tokens_expect_excluded() -> None:
    assert count_norwegian_words("hei ,,, 123 e-post …") == K_EXPECTED_WORD_COUNT
