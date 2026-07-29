#!/usr/bin/env bash
# Worker runtime entrypoint: resolve DATABASE_URL from POSTGRES_* then exec CMD.
set -Eeuo pipefail

RESOLVE_URL_JS="${RESOLVE_URL_JS:-/app/scripts/docker/resolve-database-url.mjs}"

if [ ! -f "$RESOLVE_URL_JS" ]; then
  echo "Missing URL resolver: $RESOLVE_URL_JS (rebuild the worker image)" >&2
  exit 1
fi

built="$(node "$RESOLVE_URL_JS")" || {
  echo "Failed to resolve DATABASE_URL from POSTGRES_* / override" >&2
  exit 1
}
if [ -z "$built" ]; then
  echo "URL resolver returned an empty DATABASE_URL" >&2
  exit 1
fi

export DATABASE_URL="$built"
export DIRECT_URL="$built"

exec "$@"
