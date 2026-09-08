from dataclasses import dataclass
from dataclasses import field

from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import UserCard
from flyt.apps.lexicons.models import WordForm
from flyt.apps.users.models import UserLemmaContext


@dataclass(frozen=True)
class DueCard:
    user_card: UserCard
    card: FlashCard
    word_forms: list[WordForm] = field(default_factory=list)
    # Human interval each FSRS rating would schedule, e.g. {"again": "1m", ...}.
    rating_previews: dict[str, str] = field(default_factory=dict)
    context: UserLemmaContext | None = None


@dataclass(frozen=True)
class QueueStateCounts:
    """Per-state counts for the live due set."""

    new: int
    learning: int
    review: int
