#!/usr/bin/env bash
set -euo pipefail

# Same stack as scripts/run_e2e.sh, but the browser loads the unpacked
# extension instead of visiting the app. The extension is rebuilt against the
# stack's API origin, because that origin is baked into host_permissions at
# build time and cannot be overridden at run time.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/e2e_stack.sh"

API_HOST="${FLYT_E2E_API_HOST:-127.0.0.1}"
API_PORT="${FLYT_E2E_API_PORT:-18000}"
APP_ORIGIN="${FLYT_E2E_APP_ORIGIN:-http://127.0.0.1:4173}"
API_URL="http://${API_HOST}:${API_PORT}"
COMPOSE_PROJECT_NAME="${FLYT_E2E_COMPOSE_PROJECT:-flyt-ext-e2e-$(date +%s)-$$}"

trap e2e_stack_down EXIT

e2e_stack_up "${API_URL}"

echo "Building the extension against ${API_URL}..."
cd "${ROOT_DIR}/extension"
# VITE_E2E_HOOKS opens the shadow root; it is the only build difference.
VITE_API_ORIGIN="${API_URL}" \
VITE_APP_ORIGIN="${APP_ORIGIN}" \
VITE_E2E_HOOKS=true \
pnpm build

echo "Ensuring Playwright Chromium is installed..."
pnpm exec playwright install chromium

echo "Running the extension E2E suite..."
FLYT_E2E_API_URL="${API_URL}" pnpm exec playwright test "$@"
