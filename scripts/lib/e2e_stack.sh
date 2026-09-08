#!/usr/bin/env bash
# Shared E2E stack bring-up for scripts/run_e2e.sh and
# scripts/run_extension_e2e.sh. Both need the same backend, the same committed
# fixtures, and the same deterministic users; only the client differs.

e2e_compose() {
  docker compose \
    -p "${COMPOSE_PROJECT_NAME}" \
    -f "${ROOT_DIR}/docker-compose.e2e.yml" \
    "$@"
}

e2e_stack_down() {
  (cd "${ROOT_DIR}" && e2e_compose down -v --remove-orphans) >/dev/null 2>&1 || true
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

  # When the host has not exported an OpenRouter key, swap the openrouter
  # provider for the stub so the generate→ready→lookup→import flow still has
  # coverage without a paid call. ChatGPT stays offered (locked) so the surface
  # mirrors production. The recording spec still needs the real key and skips
  # without one.
  if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
    export STORY_GENERATION_ENABLED_PROVIDERS='["stub","chatgpt"]'
    echo "OPENROUTER_API_KEY not set; stub provider enabled (canned text, no model call), chatgpt offered (locked) for this run."
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
