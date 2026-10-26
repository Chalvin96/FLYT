# Flashcards

A card pool identifies one stable concept. Each learner keeps separate scheduling state,
and the card payload stays a snapshot so a dictionary update does not silently change a
question already in use.

The scheduler calculates due state from the learner's current card state. Repeated
requests, including requests from another tab, reuse an active card issuance until the
review resolves it. The unresolved issued variant is separate from rotation history, so
only that exact card can be submitted while an issuance is active. Once resolved,
the last shown variant can repeat within the same review session without another
issuance. A new issuance takes precedence and rejects sibling variants.

Each learner card has a `review_version` starting at zero. Due cards expose the current
version, and every graded or ungraded submission must send it. A resolved submission
increments the version under the card's row lock and returns it for the next in-session
repeat. A stale version returns HTTP 409 with `REVIEW_STALE` without changing scheduling
state or review logs, so duplicate submissions and answers from another tab cannot
resolve the same version twice. The session keeps the returned version on retained
learning cards and prompts the learner to reload after a stale review.

Learning and relearning cards are eligible through the current UTC day; review cards are
eligible only when due. One application-clock instant drives a review's schedule, log,
and first introduction. Enrollment and daily new-card limits are per learner.

Graded outcomes update FSRS state and write a review log. Write skips, unavailable
evaluation, and unsupported cards are ungraded: they clear the active issuance and
increment the review version without changing scheduling state or review history.
Unsupported is valid for every card type; skip and unavailable evaluation apply only
to Write.

The review endpoint commits FSRS changes and the review log together. Dashboard stats
read those records and card state without writing to either.

The review session owns its issued queue, submissions, accepted-result counts, accuracy,
and completion state. It applies accepted results locally and invalidates due cards,
decks, and dashboard stats when it ends. A failed initial queue load stays retryable
rather than appearing empty.

Lesson and review hosts choose retry behavior. Lessons allow another attempt; review
commits the first check. Match can finish all pairs before grading once, while Build and
Categorize stop on the first wrong review action. Session accuracy uses explicit
correctness from accepted graded outcomes and excludes ungraded outcomes.

In a lesson, completion after a wrong attempt remains correct but receives Hard;
first-try completion receives Easy. A reveal is incorrect and receives Hard at 50% or
more correct, otherwise Again. Definition self-ratings keep the learner's rating, with
Again and Hard incorrect and Good and Easy correct.

RecallFill places the selected form in the sentence because reading the completed
sentence is the task.

Flipping a definition card moves focus to the answer's lemma heading.

TokenBoard keeps movable tokens in one slot-indexed array so drag and tap use the same
controlled state. Categorize moves assignments to the correct buckets on reveal while
keeping verdict colors tied to the learner's original assignments.

The exercise attempt owns terminal outcome emission. A host accepts an outcome before a
Write draft is cleared. Unsupported lesson exercises can be completed without inventing
a grade; unsupported review cards resolve as ungraded.

Review Write drafts are scoped to learner and card. A legacy draft moves only when the
new key is empty, so drafts do not cross learners or cards and existing work is not
overwritten during migration.
