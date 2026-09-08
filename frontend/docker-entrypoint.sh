#!/bin/sh
set -e

# Replace the build-time placeholder with the runtime FLYT_API_URL.
# This allows a single pre-built image to be pointed at any backend.
if [ -n "$FLYT_API_URL" ]; then
  ESCAPED_URL=$(printf '%s\n' "${FLYT_API_URL}" | sed 's/[&\\]/\\&/g')
  find /usr/share/nginx/html -name "*.js" \
    -exec sed -i "s|__FLYT_API_URL__|${ESCAPED_URL}|g" {} \;
fi

exec nginx -g "daemon off;"
