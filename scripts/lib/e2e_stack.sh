#!/usr/bin/env bash
# Shared E2E stack bring-up for scripts/run_e2e.sh and
# scripts/run_extension_e2e.sh. Both need the same backend, the same committed
# fixtures, and the same deterministic users; only the client differs.

export FLYT_E2E_PROVIDER_CREDENTIAL_KEY="${FLYT_E2E_PROVIDER_CREDENTIAL_KEY:-$(python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")}"

e2e_compose() {
  docker compose \
    -p "${COMPOSE_PROJECT_NAME}" \
    -f "${ROOT_DIR}/docker-compose.e2e.yml" \
    "$@"
}

e2e_stack_down() {
  (cd "${ROOT_DIR}" && e2e_compose down -v --remove-orphans --rmi local) >/dev/null 2>&1 || true
}

wait_for_url() {
  local url="$1"
  local label="$2"

  for _ in $(seq 1 120); do
    if curl -fsS "${url}" >/dev/null; then
      echo "${label} ready: ${url}"
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for ${label} at ${url}" >&2
  return 1
}

# Brings up the stack and loads every committed fixture. The user seed derives
# lesson progress and review pools from imported lesson data, so it cannot run
# against the lexicon alone.
e2e_stack_up() {
  local api_url="$1"

  cd "${ROOT_DIR}"

  if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
    export STORY_GENERATION_ENABLED_PROVIDERS='["stub","chatgpt"]'
    echo "OPENROUTER_API_KEY not set; stub provider enabled (canned text, no model call), chatgpt offered (locked) for this run."
  else
    export STORY_GENERATION_ENABLED_PROVIDERS='["openrouter","chatgpt","stub"]'
    echo "OPENROUTER_API_KEY set; openrouter enabled for the recording spec, stub also enabled for the always-on flow spec."
  fi

  echo "Starting fresh E2E stack with project ${COMPOSE_PROJECT_NAME}..."
  e2e_compose up -d --build

  wait_for_url "${api_url}/" "backend"

  echo "Importing committed lexicon fixture..."
  e2e_compose exec -T backend \
    python scripts/import_lexicon.py /app/tests/fixtures/e2e/lexicon/lemma

  echo "Assigning deterministic frequency_rank to imported lemmas (generation needs it)..."
  e2e_compose exec -T backend \
    python scripts/seed_e2e_frequency_ranks.py

  echo "Importing committed lesson fixture..."
  e2e_compose exec -T backend \
    python scripts/import_lessons.py /app/tests/fixtures/e2e/lesson-data

  echo "Importing committed reading fixture..."
  e2e_compose exec -T backend \
    python scripts/import_reading_stories.py /app/tests/fixtures/e2e/reading-stories.json

  echo "Seeding deterministic E2E users..."
  e2e_compose exec -T backend python scripts/seed_e2e.py
}

run_playwright_tests() {
  if [[ -z "${FLYT_PLAYWRIGHT_IMAGE:-}" ]]; then
    pnpm exec playwright install chromium
    pnpm exec playwright test "$@"
    return
  fi

  local user_args=(--user "$(id -u):$(id -g)")
  if docker info --format '{{.SecurityOptions}}' | grep -q rootless; then
    user_args=()
  fi

  docker run --rm --network host --ipc host \
    "${user_args[@]}" \
    --env HOME=/tmp \
    --env FLYT_E2E_BASE_URL --env FLYT_E2E_API_URL --env CI \
    --env OPENROUTER_API_KEY --env FLYT_E2E_FIXTURE_PORT \
    --volume "${ROOT_DIR}:${ROOT_DIR}" \
    --workdir "${PWD}" \
    "${FLYT_PLAYWRIGHT_IMAGE}" \
    ./node_modules/.bin/playwright test "$@"
}
