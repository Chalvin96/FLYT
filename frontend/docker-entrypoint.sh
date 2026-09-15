#!/bin/sh
set -e

# Replace the build-time placeholder with the runtime FLYT_API_URL.
# This allows a single pre-built image to be pointed at any backend. Fail
# startup instead of serving a healthy-looking frontend with broken API calls.
: "${FLYT_API_URL:?FLYT_API_URL must be set}"

ESCAPED_URL=$(printf '%s\n' "${FLYT_API_URL}" | sed 's/[&\\]/\\&/g')
find /usr/share/nginx/html -name "*.js" \
  -exec sed -i "s|__FLYT_API_URL__|${ESCAPED_URL}|g" {} \;

exec nginx -g "daemon off;"
