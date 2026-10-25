# Flyt engineering guidance

Flyt is a pnpm monorepo: FastAPI/SQLAlchemy/Alembic backend, React/TanStack
frontend, Manifest V3 extension, PostgreSQL, Redis/arq workers, and shared
`@flyt/ui` and `@flyt/lexicon` packages.

Start with `knowledge/architecture/system.md` and
`knowledge/architecture/decisions.md`, then read the documents that own the
changed behavior under `knowledge/product/`, `knowledge/domains/`,
`knowledge/data/`, `knowledge/platform/`, `knowledge/design-system/`, or
`knowledge/operations/`.
These documents cover durable decisions and invariants.

Preserve API paths/schemas, database table/enum/constraint names, serialized
worker identities, authentication, quotas, privacy, and transaction phase
boundaries. Routers compose services; services do not import routers. Keep
transport, query policy, page composition, and local interaction state separate.
Use React context only for the cases in `knowledge/platform/frontend.md`;
prefer props, `children`, or a registry entry.

From the repository root, generate Alembic migrations with
`uv run --directory backend alembic revision --autogenerate -m "description"`;
do not hand-write migrations. Regenerate `frontend/src/types/api.generated.ts`
with `pnpm --filter frontend api:types` after API schema changes, and check it
with `pnpm --filter frontend api:types:check`.

Do not commit planning artifacts, dated archives, or task history.
Update durable docs only for changed durable facts. Keep setup/operations in
`knowledge/operations/runtime.md` or the owning service README, and attribution with its license
notices.

Do not explain code with comments. Make the code readable instead — name the
value, extract the function, let the type carry the constraint — and put durable
rationale in `knowledge/`, where it is reviewed and cannot rot beside a line it
no longer describes. Keep a comment only for something the code cannot state:
load-bearing declaration order, a platform behavior that reads as a bug, a
deliberate omission. One-line prop documentation defining a caller contract is
fine; a paragraph above an export is not. A comment that restates the line below
it, repeats the name of the test it sits in, or duplicates prose already in
`knowledge/` is noise — delete it.

Run focused checks for changed boundaries, then the affected workspace's type
check, lint, tests, build, and quality gates. Use isolated test databases and
Redis; never point tests at development or production data. Do not add generic
tutorials, index-only docs, or history logs.
