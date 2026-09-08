from flyt.apps.flashcards.constants import ReviewOutcome
from flyt.apps.flashcards.schemas import ReviewSubmission


def test_review_submission_given_wire_outcome_expect_shared_enum() -> None:
    submission = ReviewSubmission(card_id=1, outcome="graded", rating=3)

    assert submission.outcome is ReviewOutcome.GRADED
