from pydantic import ValidationError
import pytest

from flyt.apps.flashcards.constants import ReviewOutcome
from flyt.apps.flashcards.schemas import ReviewSubmission


def test_review_submission_given_wire_outcome_expect_shared_enum() -> None:
    submission = ReviewSubmission(
        card_id=1, outcome="graded", rating=3, review_version=0
    )

    assert submission.outcome is ReviewOutcome.GRADED


def test_review_submission_given_missing_version_expect_validation_error() -> None:
    with pytest.raises(ValidationError, match="review_version"):
        ReviewSubmission.model_validate(
            {"card_id": 1, "outcome": "graded", "rating": 3}
        )
