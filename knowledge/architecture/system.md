# System architecture

Flyt is a pnpm monorepo with a FastAPI, SQLAlchemy, and Alembic backend; a React and
TanStack frontend; a Manifest V3 extension; PostgreSQL; and Redis with arq workers.

Routers authenticate and compose domain services. They handle HTTP concerns; services
stage domain changes and never import routers. Routers, workers, and import commands
commit at explicit transaction boundaries. Session cleanup rolls back only uncommitted
work, so a later failure cannot undo a committed phase. Workers call public service
operations.

Frontend API modules serialize requests, capability query modules own TanStack keys and
cache policy, and pages compose screen state. Local interaction state stays beside the
operation that owns it.

UI dependencies point one way: `@flyt/lexicon` uses `@flyt/ui`, and the frontend and
extension use both. `@flyt/ui` stays domain-neutral, and shared packages do not import
app code.

PostgreSQL owns durable account, content, learner, accounting, and generation state.
Redis backs worker queues and bounded rate-limit coordination.

Quota-controlled provider work commits admission before dispatch. A failed or cancelled
call still spends its debit. Story generation can send selected vocabulary and story
instructions to a configured provider. Chatbot requests can send the current message,
bounded recent history, and page context. The browser keeps chatbot history; the backend
does not store conversations.

Provider credentials, cancellation, and provider-specific failure handling stay with the
domain that owns the integration.

Lesson and lexicon releases are producer-owned, versioned artifacts. Import checks
compatibility before activation.

Account deletion commits removal of account-owned data before best-effort external
credential cleanup and clears the authentication cookie. Backend errors go to
structured logs only. Optional browser Sentry reports technical errors with cookies,
user info, HTTP bodies, and AI inputs and outputs disabled.
Application database error messages omit bound parameters to keep learner text out of logs.

Keep API paths and schemas, generated API types, database table, enum, and constraint
names, serialized worker identities, authentication, quota behavior, privacy rules, and
transaction boundaries stable during internal moves.

The published backend container defaults to production. Local configuration must opt
into development-only routes.
