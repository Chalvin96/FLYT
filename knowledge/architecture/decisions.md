# Decisions

| Decision                                           | Rationale                                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Compute review due state on read                   | A single source of truth avoids a stale materialized queue.                                         |
| One learner card per stable concept pool           | Scheduling belongs to the concept while surface variants rotate.                                    |
| Keep content and evaluation separate               | Imported content can evolve without coupling provider/evaluator configuration to learner runtime.   |
| Lemma identity is POS plus homograph               | Meaning and inflection relationships must not collapse distinct dictionary entries.                 |
| Pronunciation is a release artifact                | IPA, pitch accent, and TTS provenance are reproducible and do not depend on a device speech engine. |
| Async PostgreSQL with savepoint-isolated tests     | Production sessions stay async and tests roll back independently without deleting shared fixtures.  |
| Cookie auth for the browser                        | HTTP-only cookies protect the browser session; extension calls bridge per request.                  |
| Generated lesson packets use discriminated schemas | Producers and consumers can reject unsupported versions before graph execution.                     |
| Shared operation registry                          | Lesson and review behavior stays exhaustive and media resolution stays consistent.                  |

When a new decision changes one of these boundaries, update this table and the owning domain document.
