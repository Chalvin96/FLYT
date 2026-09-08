#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/e2e_stack.sh"

API_HOST="${FLYT_E2E_API_HOST:-127.0.0.1}"
API_PORT="${FLYT_E2E_API_PORT:-18000}"
FRONTEND_HOST="${FLYT_E2E_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FLYT_E2E_FRONTEND_PORT:-4173}"
BASE_URL="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
API_URL="http://${API_HOST}:${API_PORT}"
COMPOSE_PROJECT_NAME="${FLYT_E2E_COMPOSE_PROJECT:-flyt-e2e-$(date +%s)-$$}"
PREVIEW_LOG="/tmp/flyt-e2e-preview-${COMPOSE_PROJECT_NAME}.log"
PREVIEW_PID=""

cleanup() {
  # Kill the process group: PREVIEW_PID is the pnpm wrapper, and killing it
  # alone orphans the vite child, which then squats the port.
  if [[ -n "${PREVIEW_PID}" ]] && kill -0 "${PREVIEW_PID}" 2>/dev/null; then
    kill -- "-${PREVIEW_PID}" 2>/dev/null || kill "${PREVIEW_PID}" 2>/dev/null || true
    wait "${PREVIEW_PID}" 2>/dev/null || true
  fi

  e2e_stack_down
}

trap cleanup EXIT

e2e_stack_up "${API_URL}"

echo "Building frontend preview against ${API_URL}..."
cd "${ROOT_DIR}/frontend"
FLYT_API_URL="${API_URL}" pnpm build

echo "Ensuring Playwright Chromium is installed..."
pnpm exec playwright install chromium

echo "Starting frontend preview on ${BASE_URL}..."
setsid pnpm preview --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" --strictPort >"${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

wait_for_url "${BASE_URL}/login" "frontend preview"

echo "Running Playwright E2E suite..."
FLYT_E2E_BASE_URL="${BASE_URL}" \
FLYT_E2E_API_URL="${API_URL}" \
pnpm exec playwright test "$@"
