#!/bin/sh
set -e

# Replace the build-time placeholder with the runtime FLYT_API_URL.
# This allows a single pre-built image to be pointed at any backend while
# failing startup instead of serving a healthy-looking but unusable frontend.
if [ -z "${FLYT_API_URL:-}" ]; then
  echo "FLYT_API_URL must be set" >&2
  exit 1
fi

ESCAPED_URL=$(printf '%s\n' "${FLYT_API_URL}" | sed 's/[&\\]/\\&/g')
find /usr/share/nginx/html -name "*.js" \
  -exec sed -i "s|__FLYT_API_URL__|${ESCAPED_URL}|g" {} \;

if grep -R -q --include='*.js' '__FLYT_API_URL__' /usr/share/nginx/html; then
  echo "Failed to configure FLYT_API_URL in the frontend bundle" >&2
  exit 1
fi

exec nginx -g "daemon off;"
