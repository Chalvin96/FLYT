#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_URL="${MIGRATION_DRIFT_SERVER_URL:-postgresql://postgres:postgres@localhost:55432}"
DATABASE="migration_drift_$$"

psql "${SERVER_URL}/postgres" -q -c "CREATE DATABASE ${DATABASE}"
trap 'psql "${SERVER_URL}/postgres" -q -c "DROP DATABASE IF EXISTS ${DATABASE}"' EXIT

export ENV=test
export SECRET_KEY=test-secret-key-for-ci-checks-only-not-production
export DATABASE_URL="postgresql+psycopg://${SERVER_URL#postgresql://}/${DATABASE}"
export GOOGLE_CLIENT_ID=test-google-client-id
export GOOGLE_CLIENT_SECRET=test-google-client-secret
export OAUTH_SESSION_SECRET=test-oauth-session-secret
export ADMIN_SESSION_SECRET=test-admin-session-secret-for-ci-checks-only
export PROVIDER_CREDENTIAL_ENCRYPTION_KEYS="${PROVIDER_CREDENTIAL_ENCRYPTION_KEYS:-[\"$(python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")\"]}"
export OPENROUTER_API_KEY=ci-openrouter-key-not-real

cd "${ROOT_DIR}/backend"
uv run alembic upgrade head
uv run alembic check
