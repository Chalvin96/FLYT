# Data lifecycle and ownership

Account deletion stages one all-or-nothing database transaction. The router commits
before external cleanup and clears the authentication cookie. External cleanup is
best-effort and cannot undo the committed deletion.

Deletion removes account-owned credentials, progress, review history, generation
records, and import references. Shared dictionary, lesson, card-pool, and curated
reading content remains. Provider aggregate usage windows also remain, so account
deletion never refunds consumed shared stock.

Import cleanup selects only private stories with import metadata. It deletes a story
only after its last learner reference is removed under the content lock. Curated stories
never enter this cleanup path. Deleting an imported story also removes its pages and
import metadata.

Import admission, import deletion, and account deletion acquire the per-user quota lock
before content locks. Account deletion acquires content locks in sorted hash order. This
prevents orphaned imports and lock-order deadlocks.

The import limit is 200 active private references with import metadata. Pending,
processing, ready, and failed imports count. Reimporting content the learner already
owns uses no extra slot, and deleting an import frees one. There is no lifetime counter.

Commit before enqueue or publication. Workers must not observe work that the database
later rolls back.
