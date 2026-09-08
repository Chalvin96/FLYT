# Flashcards

A card pool is the stable concept identity; a user card owns FSRS state and the scheduler rotates snapshot variants. Card payloads are snapshots so later dictionary edits do not rewrite a learner's question. Enrollment and add-more-new limits are enforced per learner and pool.

Grading maps correct and incorrect outcomes to scheduler ratings; skipped or unavailable speech/writing evaluation is ungraded. A submission updates the active session queue locally; leaving the session invalidates due cards, decks, and dashboard stats.

Due-card issuance records the unresolved variant separately from the most recently
resolved variant. Repeated requests, including requests from another tab, reuse the
active issued variant until review resolves it; successful graded and ungraded
submissions clear that active issuance while retaining the last resolved variant for
rotation and exact-variant validation.

My Cards derives mastery buckets from current FSRS state, merges pages before grouping, preserves first-seen order, and keeps loaded rows visible when a later page fails. Search/facet/sort and accessible expansion state belong to the page/view.
