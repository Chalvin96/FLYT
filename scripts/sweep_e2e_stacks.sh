#!/usr/bin/env bash
set -euo pipefail

for project in $(docker compose ls --all --quiet | grep -E '^flyt-(ext-)?e2e-' || true); do
  docker compose -p "${project}" down -v --remove-orphans --rmi local >/dev/null 2>&1 || true
done

pkill -f 'vite preview' 2>/dev/null || true
