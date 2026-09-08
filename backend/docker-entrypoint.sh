#!/bin/sh
set -e

# Set RUN_MIGRATIONS=false on multi-replica app instances to avoid concurrent
# `alembic upgrade` on boot; run one dedicated migrate job instead.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  alembic upgrade head
fi

exec "$@"
