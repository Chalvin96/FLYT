# Lessons

Lesson packets are producer-owned versioned content. Wire schema validation handles discriminators, fields, and audio path integrity; graph validation separately checks duplicate IDs, references, dialogue/request-note reachability, and audio reachability. Importers call both layers explicitly. V4 content accepts both singular `example` blocks and grouped `examples` blocks, and reading blocks may carry the producer's speaker icon URL.

Lesson content is the source of truth for exercise payloads and media. Learner runtime/evaluation is injectable and does not own provider configuration. Completing a lesson subscribes the learner to its pools. Reconciliation preserves state for unchanged stable identities; it does not preserve state for content removed from the release. Public import operations remain stable for scripts and workers.

Keep exercise operation identity exhaustive and retain audio resolution by `audio_id`. Do not change producer JSON Schema, packet versions, external artifact compatibility, or database names during boundary refactors.

The catalog is the release inventory and order. An omitted lesson is removed
with its lesson-owned pools, progress, user cards, and review history.
Authored exercise IDs are learner-progress identities: preserve them when
meaning is unchanged, assign a new ID for a semantic replacement. Moving a
stable exercise from a removed pool to one destination migrates its learner
state before deleting the old pool. `family_id` is metadata, never a second
ordering source.

The producer JSON Schema, typed packet, and graph/audio checks all run before
persistence. Fixed `schema_version` and `language` fields may be required or
defaulted by the producer without changing the v4 wire contract. `--dry-run`
never writes; content activation flushes and the importer commits the complete
release. Audio remains producer-hosted; existing local audio is only an optional
integrity check.

Write-criterion IDs must be unique and stable: evaluation joins provider
verdicts to them. The authored `judge_prompt` is private and stripped from
learner responses. An unavailable or incomplete evaluation is retryable and
ungraded, never a fabricated score.
