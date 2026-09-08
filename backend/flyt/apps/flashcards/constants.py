from enum import StrEnum
from typing import Final
from typing import Literal

from fsrs import Scheduler
from fsrs import State

from flyt.apps.flashcards.models import CardState

SCHEDULER = Scheduler(enable_fuzzing=True)

K_DEFAULT_STUDY_LIMIT = 20
K_QUICK_REVIEW_CARD_COUNT = 10

# User-triggered add-more-new cap; separate from automatic daily drip allowance.
K_ADD_MORE_NEW_CARD_COUNT_MAX: Final = 50

K_REVIEW_MODE_QUICK: Final = "quick"
K_REVIEW_MODE_FULL: Final = "full"


class ReviewOutcome(StrEnum):
    GRADED = "graded"
    SKIPPED = "skipped"
    SERVICE_UNAVAILABLE = "service_unavailable"


# Mastery-bucket stability thresholds (in days) for the /me/cards gallery.
K_MASTERY_FAMILIAR_MAX: Final = 30.0
K_MASTERY_KNOWN_MAX: Final = 120.0

# Default page size for /me/cards gallery pagination.
K_MY_CARDS_DEFAULT_PAGE_SIZE: Final = 50
K_MY_CARDS_MAX_PAGE_SIZE: Final = 200

type ReviewMode = Literal["quick", "full"]

DB_STATE_TO_FSRS_STATE = {
    # py-fsrs v6 has no explicit State.New, so NEW cards enter Learning state.
    CardState.NEW: State.Learning,
    CardState.LEARNING: State.Learning,
    CardState.REVIEW: State.Review,
    CardState.RELEARNING: State.Relearning,
}

FSRS_STATE_TO_DB_STATE = {
    State.Learning: CardState.LEARNING,
    State.Review: CardState.REVIEW,
    State.Relearning: CardState.RELEARNING,
}
