# Decisions

| Decision                                           | Rationale                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Compute review due state on read                   | One source of truth avoids a stale materialized queue.                                             |
| One learner card per stable concept pool           | Scheduling belongs to the concept while surface variants rotate.                                 |
| Keep content and evaluation separate               | Imported content can evolve without coupling provider configuration to learner runtime.           |
| Lemma identity uses producer IDs                  | The article and lemma pair keeps distinct entries separate when surface metadata matches. |
| Pronunciation is a release artifact                | IPA, pitch accent, and audio provenance stay reproducible without browser synthesis.              |
| Async PostgreSQL with savepoint-isolated tests     | Production sessions stay async; tests isolate writes without deleting shared fixtures.             |
| Cookie authentication for the browser             | HTTP-only cookies keep session tokens out of browser scripts; the extension bridges per request.  |
| Generated lesson packets use discriminated schemas | Producers and consumers can reject unsupported versions before graph execution.                    |
| Shared operation registry                         | Lesson and review behavior stays exhaustive, and media resolution stays consistent.               |
| PostgreSQL owns generation state and results      | Admission, worker claims, and outcomes share a transactional source of truth.                       |
| One-way UI package dependencies                   | Domain concepts stay out of the design system, and lint rejects imports against the dependency flow. |

When a new decision changes one of these boundaries, update this table and the owning
domain document.
