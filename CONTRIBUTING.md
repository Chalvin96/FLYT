# Contributing / Development setup

Full local setup for Flyt — the [README](README.md) keeps only a minimal quickstart.

## Requirements

- Python 3.12–3.13 and [uv](https://docs.astral.sh/uv/); Python 3.14 is
  currently unsupported because locked spaCy 3.8.15 has no cp314 wheel
- Node 24+ and [pnpm](https://pnpm.io/) 11; the root preinstall guard rejects other pnpm majors
- PostgreSQL 16, Redis

## Running the stack

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in values (see env table below)
uv sync
uv run python -m spacy download nb_core_news_md
uv run alembic upgrade head
uv run uvicorn flyt.main:app --reload

# 2. Frontend (new terminal)
cd frontend
pnpm install
echo "FLYT_API_URL=http://localhost:8000" > .env.local
pnpm dev

# 3. Background worker (new terminal) — needed for reading ingestion
cd backend
uv run arq flyt.worker.WorkerSettings
```

**Dev login (no Google OAuth):** with `ENV=development`, open
`http://localhost:8000/users/dev/login` to mint a session for a seeded local user
(default `dev@flyt.dev`; `?email=you@example.com` for another). Mounted **only** in
development — 404 in production, never an auth bypass.

## Environment variables (essentials)

| Variable                                    | Required     | Description                                                                             |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | yes          | `postgresql+psycopg://user:pass@host/db`                                                |
| `SECRET_KEY`                                | yes          | Random secret for JWT signing (≥32 chars)                                               |
| `ADMIN_SESSION_SECRET`                      | yes          | Random secret for admin session signing (≥32 chars, independent of `SECRET_KEY`)        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes          | Google OAuth credentials                                                                |
| `OAUTH_SESSION_SECRET`                      | yes (prod)   | Secret for the OAuth session cookie                                                     |
| `ACCESS_COOKIE_SECURE`                      | yes (prod)   | Must be `true` in production                                                            |
| `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`       | yes          | JSON array of Fernet keys; first encrypts, all decrypt                                  |
| `OPENROUTER_API_KEY`                        | when enabled | Required by the default story provider; also required by the Flyt chatbot in production |
| `REDIS_URL`                                 | no           | Defaults to `redis://localhost:6379`                                                    |
| `ENV`                                       | no           | `development` / `production` (default `development`)                                    |
| `FRONTEND_ORIGINS`                          | no           | JSON array of exact CORS origins, e.g. `["http://localhost:5173"]`                      |
| `FLYT_API_URL` (frontend)                   | yes          | Backend API base URL                                                                    |
| `STT_SVC_URL`                               | no           | Private CPU speech service URL; required only for speech transcription                  |
| `STT_MAX_AUDIO_BYTES`                       | no           | Backend speech upload cap (default `10485760`)                                          |

Generate each provider key with
`uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
from `backend/`; the example placeholder cannot boot. For development without
OpenRouter, set `STORY_GENERATION_ENABLED_PROVIDERS=[]` (or `["stub"]` for
deterministic generation). Configure Google credentials or local placeholders
even when using the development login. All settings and defaults live in
`backend/flyt/core/config.py`; `backend/.env.example` documents the common ones.

## Loading data (lessons, dictionary, reading stories)

Script-based imports run from `backend/` with `uv run python scripts/<script>.py`; reading ingestion is the `flyt.commands.reading_ingest` module described below.

**Dictionary (lexicon).** Sourced from [Ordbokene](https://ordbokene.no/) via the
[norsk-lemma](https://github.com/Chalvin96/norsk-lemma) release tarball:

```bash
uv run python scripts/import_lexicon.py https://github.com/Chalvin96/norsk-lemma/releases/download/v2026.06.22/norsk-lemma-v2026.06.22.tar.gz
```

`import_lexicon.py` accepts a directory, a local `.tar.gz`, or an `https://` tarball
URL; add `--force` to update existing articles in place. It also stores each lemma's
`frequency_rank` (Norwegian Kelly list) when the release carries it. The importer
drops untranslated definitions and skips any lemma lacking a primary translation or
at least one translated definition, so only card-ready vocabulary lands in the
database.

**Frequency deck.** After the lexicon import, build the subscribable frequency deck
from the ranked lemmas (idempotent — safe to re-run after a `--force` re-import):

```bash
uv run python scripts/create_frequency_deck.py
```

**Lessons.** Imported from the published [norsk-lesson-data](https://github.com/Chalvin96/norsk-lesson-data)
bundle (directory, local `.tar.gz`, or release URL):

```bash
LESSON_SOURCE=/path/to/release.tar.gz  # or a release URL or local directory
uv run python scripts/import_lessons.py "$LESSON_SOURCE" --dry-run
uv run python scripts/import_lessons.py "$LESSON_SOURCE"
```

Preview first: the catalog replaces the curriculum. A normal import removes
omitted lessons and their lesson-owned learner state. The full release is
validated before the importer commits one transaction. Packet audio stays on
producer-hosted HTTPS URLs; a local import does not populate a media directory.
For a deliberate local/test reset, use
`uv run python scripts/reset_lesson_release.py --confirm reset-lesson-data --import <source>`.
Release identity and reconciliation rules are in
[Lessons](knowledge/domains/lessons.md).

**Reading stories.** Markdown with YAML front-matter (`slug`, `title`, `cefr_level`,
`group`), ingested as a background job (worker must be running):

```bash
uv run python -m flyt.commands.reading_ingest https://example.com/story.md
```

## Admin

```bash
cd backend
uv run python scripts/grant_admin.py --email you@example.com
```

The admin UI is role-gated at `/admin`.

## LAN access from another device

```bash
cd frontend
pnpm dev --host 0.0.0.0        # prints a http://<LAN-IP>:5173 URL
```

- `frontend/.env.local`: `FLYT_API_URL=http://<LAN-IP>:8000` (restart Vite after changing it)
- Start the backend with `uv run uvicorn flyt.main:app --reload --host 0.0.0.0`.
- `backend/.env`: `FRONTEND_LOGIN_SUCCESS_URL=http://<LAN-IP>:5173/home`, and add the
  LAN origin to `FRONTEND_ORIGINS`.

The auth cookie is set on the host (not port-scoped), so `:5173` and `:8000` share it
across the same LAN IP.

## Tests

Backend tests create and drop their schema. Use a disposable local PostgreSQL
database named `test`, `test_*`, or `*_test`; the fixture refuses non-local
hosts and other names. Do not reuse the development database or bypass the guard.
For example, from a host with Docker and the backend environment configured:

```bash
docker run --rm -d --name flyt-pytest-db -p 127.0.0.1:15432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=test_flyt postgres:16
docker run --rm -d --name flyt-pytest-redis -p 127.0.0.1:16379:6379 redis:7-alpine
# Wait for PostgreSQL to accept connections before running pytest.
docker exec flyt-pytest-db pg_isready -U postgres -d test_flyt
cd backend
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:15432/test_flyt \
REDIS_URL=redis://127.0.0.1:16379/0 uv run pytest
docker stop flyt-pytest-db flyt-pytest-redis
```

From the repository root:

```bash
pnpm --filter frontend test --run
pnpm --filter frontend test:storybook --run
pnpm --filter @flyt/extension test
bash scripts/run_e2e.sh
bash scripts/run_extension_e2e.sh
```

The E2E scripts create a distinct Compose project, load committed fixtures, and
clean up its containers/volumes on exit. Without `OPENROUTER_API_KEY`, generation
uses the stub provider. They require Docker and local ports 18000/4173 by
default; see the scripts for `FLYT_E2E_*` overrides. Direct `pnpm e2e` expects
an already running seeded stack.

Install hooks once with `uv run --directory backend pre-commit install`.
Before review, run `pnpm spec:validate`, `pnpm quality:check`, and affected
workspace checks from `.github/workflows/_ci.yml`.

## Optional services and operations

See [morph-svc](morph-svc/README.md) for the fail-open morphology fallback and
[stt-svc](stt-svc/README.md) for private speech deployment, readiness, limits,
benchmarks, and model attribution. The worker must run separately from the API.
Apply Alembic migrations before API startup; the application does not create
tables automatically.

API/worker logs are structured; `SENTRY_DSN` enables optional error reporting.
`/metrics` exists only with `METRICS_ENABLED` and requires `METRICS_TOKEN`;
production startup enforces that token when metrics are enabled.
Application images publish after CI on master; deployment is managed outside
the repository. Provider encryption rotation and disconnect recovery are in
[ChatGPT link operations](knowledge/operations/chatgpt-link.md).

After Redis or worker recovery, inspect durable pending jobs and worker logs.
From the repository root, requeue imports past their stale window and preview
abandoned generations before settling them:

```bash
uv run --directory backend python -m flyt.commands.requeue_stale_imports
uv run --directory backend python -m flyt.commands.settle_abandoned_generations --dry-run
uv run --directory backend python -m flyt.commands.settle_abandoned_generations
```

The import command requires both `DATABASE_URL` and `REDIS_URL`; generation
settlement requires `DATABASE_URL`. Settlement uses the configured generation
TTL as its default age cutoff and marks abandoned rows failed without refunding
admitted token debits. Do not shorten that cutoff while jobs may still be live.
These commands have no built-in scheduler; arrange recurring recovery in the
deployment environment if needed.

Gate API traffic on `/health/ready` and verify the worker separately. Roll back
an application image only if it remains compatible with the applied schema;
test database restores in isolation instead of assuming a migration downgrade
is safe. Keep release image digests and migration revisions with deployment
records.

## Conventions

- **Migrations:** never hand-write Alembic files — always
  `uv run alembic revision --autogenerate -m "description"` from `backend/`.
- **Decisions** (`knowledge/architecture/decisions.md`) record current accepted rationale. Fold replaced rationale into the current decision rather than retaining obsolete decision files.
- Repository engineering guidance lives in the durable knowledge documents tree.
- CI (`.github/workflows/_ci.yml`) must be green before merge; `pr.yml` and
  `master.yml` share it so checks can't drift.
