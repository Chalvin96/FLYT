# Lessons

Lesson packets are producer-owned, versioned content. Keep packet compatibility stable
so releases can evolve without changing the learner app's contract. Learner detail,
start, completion, and evaluation requests resolve lessons only in the active release;
inactive lesson IDs return `LESSON_NOT_FOUND`.

Authored exercise IDs preserve learner progress when meaning stays the same. Give a
semantic replacement a new ID. Moving a stable exercise to one destination pool migrates
its learner state before the old pool is deleted. Removing a lesson removes its progress
and review cards.

Lesson content and evaluation have separate owners. Provider settings stay out of lesson
packets. Write criteria use stable, unique IDs, and IDs ending in `-observation` report
diagnostics without gating success. An unavailable or incomplete evaluation remains
retryable and ungraded.

The importer validates packet schema, graph references, and bundled audio before
persistence. A bad packet is rejected during preflight so a dry run catches it before
activation.

Import and reconciliation store each lesson's estimated duration alongside its
summary fields. Lesson lists read that duration without loading the packet;
detail returns the same stored estimate.

The authored judge prompt is private model-facing material. Store it with the packet for
server-side evaluation, but strip it from learner API responses. Evaluation returns
validated criterion verdicts; an unavailable evaluator does not create a score.

When any practice group contains a review-prefixed exercise, only those exercises seed
review cards. If none are prefixed, every practice exercise remains addable for legacy
packets. Every group must retain an addable variant, and import derives this eligibility
again on every release.

Dry-run validates a complete release without writing database or media changes.
Activation commits the release as one transaction. Public import operations remain
stable for scripts and workers.

Dialogue stimulus turns have no wire IDs and are not reordered, so the view keys their
arrays by position. Keep the React Doctor no-array-index-as-key baseline at 2 for these
two lists unless the wire model gains stable IDs.

Dialogue turns reject blank speakers and blank text because either would render an empty
region. Whitespace inside authored rich text remains valid spacing.

Dialogue playback follows audio ended/error events, skips turns without playable audio,
and invalidates stale callbacks when playback stops or the view unmounts. Do not advance
with duration timers; clips can have different lengths.

The write evaluator pins temperature to zero for repeatable calibration. Other provider
requests leave temperature to the provider default.
