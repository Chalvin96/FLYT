# Flashcards

A card pool is the stable concept identity; a user card owns FSRS state and the scheduler rotates snapshot variants. Card payloads are snapshots so later dictionary edits do not rewrite a learner's question. Enrollment and add-more-new limits are enforced per learner and pool.

Grading maps correct and incorrect outcomes to scheduler ratings; skipped or unavailable speech/writing evaluation is ungraded. A submission updates the active session queue locally; leaving the session invalidates due cards, decks, and dashboard stats.

Due-card issuance records the unresolved variant separately from the most recently
resolved variant. Repeated requests, including requests from another tab, reuse the
active issued variant until review resolves it; successful graded and ungraded
submissions clear that active issuance while retaining the last resolved variant for
rotation and exact-variant validation.

My Cards derives mastery buckets from current FSRS state, merges pages before grouping, preserves first-seen order, and keeps loaded rows visible when a later page fails. Search/facet/sort and accessible expansion state belong to the page/view.

Expression aliases resolve to the same lemma and therefore the same vocabulary
card pool, UserLemma, and scheduling state. When a new definition snapshot is
created, its front uses the verified primary display form and its answer face
reveals complete alternative forms. Existing snapshots remain unchanged when
the source forms are reimported.

Definition cards reveal a structured, scrollable answer after Check answer and
focus its lemma heading. The header groups part of speech, grammar, and available
pronunciation; the body leads with the primary translation and keeps forms,
inflection, and saved context accessible as reference material. On wide cards,
reference material can sit beside meanings; on narrow cards it stays in the same
scroll flow. Saved context is collapsed until requested, and the four rating
actions remain reachable below the answer.

When the first sense repeats the primary translation, the answer shows that
translation once while retaining the sense's Norwegian gloss and first example.
Additional meanings retain their order and numbering and can be expanded beyond
the initial set. Definition examples are text; pronunciation audio belongs to
the lemma header, not to each example.
