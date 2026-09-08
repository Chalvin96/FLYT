# System architecture

Flyt is a pnpm monorepo with a FastAPI/SQLAlchemy/Alembic backend, React/TanStack frontend, Manifest V3 extension, PostgreSQL persistence, and Redis/arq workers.

HTTP routers authenticate and compose domain services. Services stage persistent domain changes; routers, workers, and import commands own commits at explicit phase boundaries. Workers call the same public service operations. Frontend transport in `frontend/src/api/` serializes HTTP requests, capability query modules own TanStack keys/cache policy, and pages compose screen state. `packages/ui` and `packages/lexicon` are deliberate shared frontend/extension boundaries.

PostgreSQL is the source of durable learner, content, account, and accounting state. Redis is ephemeral coordination and generation text. External providers are called only after admission/transaction boundaries; provider credentials and cancellation stay in the owning domain. Story generation can send selected learner vocabulary and the learner's story direction, length, and topic to its configured provider. Chatbot requests can send the current message, bounded recent history, and current page context to the selected provider; the browser keeps that transient history and the backend does not persist it as a conversation. Producer-owned lesson and lexicon releases are imported as versioned artifacts, with compatibility checked at import time.

Account deletion removes account-owned progress, content references, generation records, and provider credentials in one committed transaction, then performs best-effort external credential cleanup and clears the authentication cookie. Optional Sentry reporting receives technical error events with credential and request-body fields scrubbed; authentication uses necessary HTTP-only cookies.

Keep API schemas, database table/enum/constraint names, background job identities, and commit boundaries stable when reorganizing modules.

Speech decoding stops while resampling when the configured duration is exceeded,
so compressed uploads cannot expand into an unbounded retained waveform. The
published backend container defaults to production; local configuration must
explicitly opt into development-only routes.
