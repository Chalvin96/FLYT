# Flyt engineering guidance

Flyt is a pnpm monorepo: FastAPI/SQLAlchemy/Alembic backend, React/TanStack
frontend, Manifest V3 extension, PostgreSQL, Redis/arq workers, and shared
`@flyt/ui` and `@flyt/lexicon` packages.

Start with `knowledge/architecture/system.md` and
`knowledge/architecture/decisions.md`, then read the documents that own the
changed behavior under `knowledge/product/`, `knowledge/domains/`,
`knowledge/data/`, `knowledge/platform/`, `knowledge/design-system/`, or
`knowledge/operations/`. These documents cover durable decisions and
invariants.

Preserve API paths/schemas, database table/enum/constraint names, serialized
worker identities, authentication, quotas, privacy, and transaction phase
boundaries. Routers compose services; services do not import routers. Keep
transport, query policy, page composition, and local interaction state separate.

From the repository root, generate Alembic migrations with
`uv run --directory backend alembic revision --autogenerate -m "description"`;
do not hand-write migrations. Regenerate `frontend/src/types/api.generated.ts`
with `pnpm --filter frontend api:types` after API schema changes, and check it
with `pnpm --filter frontend api:types:check`.

Use OpenSpec for non-trivial behavior or architecture changes. Keep active
artifacts under `openspec/changes/`, validate with `pnpm spec:validate`, and
retire completed changes; do not retain dated archives or task history.
Update durable docs only for changed durable facts. Keep setup/operations in
CONTRIBUTING or the owning service README, and attribution with its license
notices. Comments should explain non-obvious invariants, not narrate code.

Run focused checks for changed boundaries, then the affected workspace's type
check, lint, tests, build, and quality gates. Use isolated test databases and
Redis; never point tests at development or production data. Do not add generic
tutorials, index-only docs, or history logs.
