#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_ID:?The scanned image ID is required}"
: "${IMAGE_TAGS:?At least one image tag is required}"

while IFS= read -r tag; do
  [[ -n "$tag" ]] || continue
  docker image tag "$IMAGE_ID" "$tag"
  docker image push "$tag"
done <<< "$IMAGE_TAGS"
