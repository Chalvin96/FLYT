# Data lifecycle and ownership

Account deletion stages one all-or-nothing database transaction; the router
commits before external cleanup. Authentication resolves the user on every
request, so deletion invalidates every stateless session. A failed or unknown
destructive response is never described as a confirmed rollback.

Account-owned references, credentials, learner progress, review history, and
generation records are deleted with the account. Shared dictionary, lesson,
card-pool, and curated reading content survives account deletion. Provider
aggregate usage windows also survive: account deletion never refunds already
consumed shared stock. The ownership inventory test covers every mapped table
and checks that the model registry imports every app model module.

Private imported stories are released only when their last learner reference
is removed, counted again under the content lock. Require both private visibility
and import metadata: curated stories must never enter this cleanup path.
Deleting a story also deletes its pages and import metadata.

Import admission and account deletion take the `quota:<user_id>` advisory lock
before `content:<hash>` locks; account deletion takes content locks in sorted
hash order. This prevents concurrent imports from leaving orphans and prevents
deadlocks between overlapping deletions. Duplicate imports do not debit the
lifetime import quota; deletion never refunds it.

Commit before enqueue or publication. External cleanup after account deletion
is best-effort and logged on failure; it cannot undo or report failure for an
already committed deletion.
