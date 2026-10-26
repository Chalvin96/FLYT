# Runtime

Local setup, data loading, tests and operations for Flyt. The [README](../../README.md) keeps only a quickstart.

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/); CI and the backend
  container currently use Python 3.14
- Node 24+ and [pnpm](https://pnpm.io/) 12; the root preinstall guard rejects other pnpm majors
- PostgreSQL 16, Redis

For PostgreSQL in Docker, set `shm_size: 256m` on the database service in
Compose, or pass `--shm-size=256m` to `docker run`. Parallel query plans can
exceed Docker's default 64 MB `/dev/shm` allocation and fail with
`could not resize shared memory segment`.

## Running the stack

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in values (see env table below)
uv sync
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

| Variable                                    | Required     | Description                                                                                                        |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | yes          | `postgresql+psycopg://user:pass@host/db`                                                                           |
| `SECRET_KEY`                                | yes          | Random secret for JWT signing (≥32 chars)                                                                          |
| `ADMIN_SESSION_SECRET`                      | yes          | Random secret for admin session signing (≥32 chars, independent of `SECRET_KEY`)                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes          | Google OAuth credentials                                                                                           |
| `OAUTH_SESSION_SECRET`                      | yes (prod)   | Secret for the OAuth session cookie                                                                                |
| `ACCESS_COOKIE_SECURE`                      | yes (prod)   | Must be `true` in production                                                                                       |
| `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`       | yes          | JSON array of Fernet keys; first encrypts, all decrypt                                                             |
| `OPENROUTER_API_KEY`                        | when enabled | Required by the default story provider; also required by the Flyt chatbot in production                            |
| `REDIS_URL`                                 | no           | Defaults to `redis://localhost:6379`                                                                               |
| `ENV`                                       | no           | `development` / `test` / `e2e` / `production` (default `production`); local runs must set `development` explicitly |
| `FRONTEND_ORIGINS`                          | no           | JSON array of exact CORS and cookie mutation origins, e.g. `["http://localhost:5173"]`                             |
| `FLYT_API_URL` (frontend)                   | yes          | Backend API base URL; set the repository variable for production image builds                                      |

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
uv run python scripts/import_lexicon.py https://github.com/Chalvin96/norsk-lemma/releases/download/v2026.09.11/norsk-lemma-v2026.09.11.tar.gz
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

**Lessons.** Imported from the published
[norsk-lesson-factory](https://github.com/Chalvin96/norsk-lesson-factory)
bundle (directory, local `.tar.gz`, or release URL):

```bash
LESSON_RELEASE=vREPLACE_WITH_VALIDATED_TAG
LESSON_SOURCE="https://github.com/Chalvin96/norsk-lesson-factory/releases/download/$LESSON_RELEASE/lessons.tar.gz"
uv run python scripts/import_lessons.py "$LESSON_SOURCE" --dry-run
uv run python scripts/import_lessons.py "$LESSON_SOURCE"
```

Choose a release validated against this Flyt revision; do not import a moving
`latest` URL into production. Preview first: the catalog replaces the curriculum. A normal import removes
omitted lessons and their lesson-owned learner state. The full release is
validated before the importer commits one transaction. Packet audio stays on
producer-hosted HTTPS URLs; a local import does not populate a media directory.
For a deliberate local/test reset, use
`uv run python scripts/reset_lesson_release.py --confirm reset-lesson-data --import <source>`.
Release identity and reconciliation rules are in
[Lessons](../domains/lessons.md).

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
ENV=test TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:15432/test_flyt \
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

Frontend visual proof lives in PR descriptions as before/after/diff triptychs.

Install hooks once with `uv run --directory backend pre-commit install`.
Before review, run `pnpm quality:check` and the affected
workspace checks from `.github/workflows/_ci.yml`.

## Extension releases

FlytLese builds for Chrome and Firefox from `extension/package.json`'s version.
Both builds use Vite's production mode and read `extension/.env.production`.
`build:firefox` sets `FLYT_BROWSER=firefox` to select Firefox without changing
the mode or environment files.
The [extension README](../../extension/README.md) contains the production build
commands used by AMO reviewers. Before a release, run:

```bash
pnpm --filter @flyt/extension lint
pnpm --filter @flyt/extension type-check
pnpm --filter @flyt/extension test
pnpm --filter @flyt/extension build
pnpm --filter @flyt/extension build:firefox
pnpm --filter @flyt/extension lint:firefox
./scripts/run_extension_e2e.sh
uv run scripts/test_extension_release.py
```

Push an `ext-v<version>` tag after the version change reaches the release commit.
The Extension Release workflow runs on the GitHub-hosted runner and rejects tags
that differ from `extension/package.json`. It builds both browsers with
`https://api.flyt.umebocchi.my.id` and `https://flyt.umebocchi.my.id`, then attaches
`flytlese-<tag>-chrome.zip`, `flytlese-<tag>-firefox.zip`, and
`flytlese-<tag>-sources.zip` to the GitHub Release. Browser ZIPs contain
`manifest.json` at their root. The sources ZIP uses `git archive` of the release
revision and includes the extension README, shared UI and lexicon packages,
workspace manifests, shared TypeScript configuration, lockfile, license, and
pnpm version guard. It also includes `.gitignore` so Tailwind excludes generated
output when building the second browser, as it does in the repository checkout.

Tag pushes publish through the extension's exact `publish-browser-extension`
6.2.0 devDependency with Chrome Web Store API v2. The workspace lockfile pins
its dependency tree. The workflow uses a frozen install and calls
`pnpm --filter @flyt/extension exec publish-extension` with absolute archive paths
because the command runs in `extension/`. Each store runs only when all its
secrets are present; otherwise the step logs which store it skipped. Publishing
failures fail the job. A manual workflow run uploads the three ZIPs as an artifact. Its `dry_run` input defaults to true
and checks authentication with `--dry-run` for configured stores without uploading
or submitting. Setting it to false only builds the artifacts. Manual runs never
publish live store updates. A credential-free publish dry run is unavailable;
the CLI's dry run still authenticates.

Configure these repository secrets:

| Secret                                | Value                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`                 | Item ID from the Chrome Web Store listing                              |
| `CHROME_PUBLISHER_ID`                 | Publisher > Settings ID in the Chrome developer dashboard              |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Google Cloud service account's `client_email`                          |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`  | Service account's PEM `private_key`, with real newlines                |
| `FIREFOX_EXTENSION_ID`                | `flytlese@flyt.umebocchi.my.id`, matching the manifest and AMO listing |
| `FIREFOX_JWT_ISSUER`                  | AMO API key's JWT issuer                                               |
| `FIREFOX_JWT_SECRET`                  | AMO API key's JWT secret                                               |

For Chrome, the owner must register a developer account, enable two-step
verification, create the listing, upload the first Chrome ZIP, and complete the
listing and privacy fields. Record the extension and publisher IDs. Enable the
Chrome Web Store API in a Google Cloud project, create a service account and JSON
key, then add its email under Account in the Chrome developer dashboard.
See [Chrome's service account setup](https://developer.chrome.com/docs/webstore/service-accounts)
and [API prerequisites](https://developer.chrome.com/docs/webstore/using-api).

For Firefox, the owner must create an AMO account, generate API credentials at
[AMO's API key page](https://addons.mozilla.org/developers/addon/api/key/), and
make the [first listed submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
with the Firefox ZIP and matching sources ZIP. Keep the Gecko ID stable for
subsequent updates. AMO requires
[source and reproducible build instructions](https://extensionworkshop.com/documentation/publish/source-code-submission/)
for bundled code. After a Firefox build, run
`pnpm --filter @flyt/extension exec web-ext run -s dist/firefox` in a graphical
Firefox environment and check real sign-in, permission revocation and regrant,
translation, and page import before publishing.

## Deploying the public images

Use the backend and frontend images from the same successful `Master` workflow
in the public `Chalvin96/FLYT` repository. The workflow builds and scans the
images before publishing them to `ghcr.io/chalvin96/flyt-backend` and
`ghcr.io/chalvin96/flyt-frontend`. Select immutable `sha-` tags or image digests;
do not use a moving `latest` tag for a deployment you need to roll back.

Before building the frontend image, set the public repository variable
`FLYT_API_URL` to the API's public HTTPS origin. The compiled frontend cannot
change this value at container startup. Google OAuth must allow the callback
configured by `GOOGLE_REDIRECT_URI`.

From the repository root, prepare the runtime configuration:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill in the image references, database password, independent signing secrets,
Google OAuth credentials, and provider encryption key. Generate signing
secrets and the database password with `openssl rand -hex 32`. Generate the
provider key with the command in the environment section above. Keep existing
signing and encryption keys when upgrading a running deployment. Replacing
keys can invalidate sessions or make saved provider credentials unreadable.

The template disables hosted AI and account linking until their provider
settings are configured. Enable only the providers you will operate. To expose
metrics, set `METRICS_ENABLED=true` and a separate `METRICS_TOKEN`.

Configure HTTPS routing to the API on port 8000 and the frontend on port 8080.
Host-managed reverse proxies can use the loopback port bindings in the template.
For Coolify, route both domains to the corresponding container ports on its
managed proxy network. Keep PostgreSQL and Redis off public host ports. Set
`FORWARDED_ALLOW_IPS` to the actual trusted reverse proxy addresses or networks.
Include both the web and API origins in `FRONTEND_ORIGINS` if you use the admin UI.

Back up the existing database and verify the backup can be restored before
upgrading. Pause the existing API and workers while running schema migrations,
then start all services at the new revision. The Compose file runs one migration
job before starting the API and worker; neither runtime process migrates on boot.

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml pull
# On upgrades, drain incoming traffic and stop the existing runtime first.
docker compose --env-file .env.production -f docker-compose.production.yml stop backend worker
docker compose --env-file .env.production -f docker-compose.production.yml up -d
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

The API must answer `/health/ready`; Docker also checks the worker's Redis
heartbeat. Confirm Google sign-in, dictionary lookup, a lesson, and a review in
the browser before routing learners to the new deployment. Test translation and
page import if you enabled them. Migration success and an HTTP 200 at `/` alone
do not verify the learning experience.

Load producer data only after validating each release against this Flyt
revision. Pin the exact lexicon and lesson archive URLs you have checked.
Run the lesson import with `--dry-run` first. An archive's declared schema version
alone does not prove every exercise operation is supported. Provider-free lesson
exports without audio are rehearsal artifacts, not complete learner releases.
See the lesson producer's release runbook for approval, audio verification, and
publication.

For rollback, keep the previous immutable images and the database backup.
Changing the image tag does not reverse a schema migration. Restore a tested
backup when the previous application cannot use the migrated schema; do not
run an unreviewed Alembic downgrade on learner data. Keep the same signing and
provider-encryption keys with the restored database.

## Optional services and operations

See [morph-svc](../../morph-svc/README.md) for the fail-open morphology fallback.
The worker must run separately from the API. Both run from the backend
image, and its health check covers both: the API must answer `/health/ready`,
the worker must keep its arq heartbeat in Redis fresh (30 s interval).
The application never creates tables itself. The backend image's entrypoint
runs `alembic upgrade head` before the server starts; set `RUN_MIGRATIONS=false`
on every replica but one, or run a dedicated migration job, so replicas do not
migrate concurrently.

With `ENV=production` (the settings and backend image default) the API refuses to start
unless these are set: `SECRET_KEY` and `ADMIN_SESSION_SECRET` (each at least 32
characters), `OAUTH_SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`, `ACCESS_COOKIE_SECURE=true`, and
`METRICS_TOKEN` (metrics are on by default; set `METRICS_ENABLED=false` to drop
the route instead). `OPENROUTER_API_KEY` is required while an OpenRouter story
provider or the `flyt` chatbot model is enabled; set
`STORY_GENERATION_ENABLED_PROVIDERS=[]` and `CHATBOT_ENABLED_MODELS=[]` to run
without one. The `stub` story provider is rejected in production. Point
`DATABASE_URL` and `REDIS_URL` at the deployment's services (both default to
localhost), and set `FRONTEND_ORIGINS` and `FRONTEND_LOGIN_SUCCESS_URL` to the
deployed web origin. The frontend image bakes `FLYT_API_URL` in at build time
and serves the app from unprivileged nginx on port 8080.

Unsafe requests carrying the access cookie require an allowed Origin or Referer
origin. Include the API's public origin in `FRONTEND_ORIGINS` when using `/admin`,
because admin forms submit from the API origin. E2E Compose sets `ENV=e2e`, enables
test auth, derives allowed origins from `FLYT_E2E_*` host/port settings, and publishes
the API only on `127.0.0.1`. `ENABLE_E2E_TEST_AUTH=true` is rejected outside E2E.

The API rejects request bodies over 64 MiB with 413 before JSON parsing, including
streams without Content-Length or with an understated length. This allows a
10,000,000-byte import plus JSON escaping and metadata. Import schemas also limit
text to 10,000,000 characters, and normalized UTF-8 text remains capped at
10,000,000 bytes. Import search accepts at most 200 characters and treats SQL LIKE
wildcards literally.

Moving-window limits share Redis state across API replicas and fail open on storage
errors. Each user has 30 import attempts per 60 seconds shared by paste, extension,
retry, and generated-story import, plus 10 story-generation attempts per 60 seconds.
The public lexicon resolve, suggestions, search, browse, and definitions routes share
300 requests per minute, counted per signed-in user or, for anonymous requests,
per client IP. Exhaustion returns 429 and `Retry-After`.

Client IP comes from `request.client.host`. Behind a reverse proxy, run uvicorn with
`--proxy-headers` and set `--forwarded-allow-ips` or `FORWARDED_ALLOW_IPS` to the
trusted proxy addresses or networks. The Docker CMD enables `--proxy-headers`;
uvicorn trusts only loopback by default. Do not trust arbitrary forwarded headers
from clients. Configure proxy trust before relying on per-client-IP limits.

API and admin responses include `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a CSP containing only
`frame-ancestors 'none'`, which permits admin scripts and styles. Production also
sends `Strict-Transport-Security: max-age=31536000`; other environments omit HSTS.

API/worker errors go to structured logs only.
`/metrics` exists only with `METRICS_ENABLED` and requires `METRICS_TOKEN`;
production startup enforces that token when metrics are enabled.
Application images publish after CI on master; deployment is managed outside
the repository.

### Provider credential rotation

`PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` is an ordered Fernet keyring. New
credentials use the first key. Reads try the listed keys in order, so keep old
keys while stored values still depend on them. Prepend a new key when rotating.
The repository has no bulk re-encryption command. Keep the keyring separate from
database backups.

Set `CHATGPT_LINK_ENABLED=false` and restart the backend to reject new link
starts and polls. The flag does not cancel an in-flight request or prevent the
ChatGPT provider from using an existing link.

Backend and frontend releases each build once, scan the loaded image ID with
Trivy, then push that same image under the metadata tags. A failed scan prevents
publication. Each release job uses a named BuildKit builder on a GitHub-hosted runner.
Runner storage is ephemeral, so builds start cold and no release cache is
transferred to GitHub Actions. Each image's releases
share a concurrency group so builder cleanup cannot interrupt another release of
that image. Release scans keep their Trivy databases under `RUNNER_TOOL_CACHE`
instead of the Actions cache.

Run `uv run scripts/test_image_pipeline.py -v` to check the release workflow and
the publish helper.

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
TTL as its age cutoff: it marks abandoned rows failed without
refunding admitted token debits and clears expired topic/text/pages while
keeping the generation row and its non-content observability. Do not shorten
that cutoff while jobs may still be live. These commands have no built-in
scheduler; arrange recurring recovery in the deployment environment if needed.

Gate API traffic on `/health/ready` and verify the worker separately. Roll back
an application image only if it remains compatible with the applied schema;
test database restores in isolation instead of assuming a migration downgrade
is safe. Keep release image digests and migration revisions with deployment
records.
