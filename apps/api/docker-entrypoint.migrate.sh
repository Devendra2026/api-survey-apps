#!/bin/sh
set -e

# Prefer DIRECT_URL over pooled DATABASE_URL for migrations when both are set.
if [ -n "$DIRECT_URL" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL or DIRECT_URL is required to run migrations" >&2
  exit 1
fi

case "$DATABASE_URL" in
  *REPLACE_ME*)
    echo "DATABASE_URL still contains REPLACE_ME_* — set the real Postgres password in Dokploy env before deploy." >&2
    exit 1
    ;;
  *@localhost*|*@127.0.0.1*)
    echo "DATABASE_URL must use Compose hostname 'postgres', not localhost/127.0.0.1 (example: postgresql://postgres:PASS@postgres:5432/survey?schema=public)." >&2
    exit 1
    ;;
esac

cd /app/packages/database

# Runner image has no pnpm; locate the Prisma CLI from the deploy tree
# (pnpm deploy often nests bins under node_modules/.pnpm/...).
find_prisma() {
  for candidate in \
    /app/node_modules/.bin/prisma \
    /app/node_modules/.pnpm/node_modules/.bin/prisma \
    /app/packages/database/node_modules/.bin/prisma \
    /app/node_modules/prisma/build/index.js \
    /app/node_modules/@prisma/cli/build/index.js \
    ./node_modules/.bin/prisma
  do
    if [ -x "$candidate" ] || [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  # Last resort: first executable prisma bin under node_modules
  found="$(find /app/node_modules -path '*/.bin/prisma' \( -type f -o -type l \) 2>/dev/null | head -n 1)"
  if [ -n "$found" ] && { [ -x "$found" ] || [ -f "$found" ]; }; then
    echo "$found"
    return 0
  fi

  return 1
}

PRISMA_BIN="$(find_prisma)" || {
  echo "Prisma CLI not found under node_modules" >&2
  exit 1
}

# Idempotent: applies pending migrations or exits 0 with "No pending migrations to apply."
# This one-shot job is the only production migrate path (api/worker do not run migrate).
echo "Running prisma migrate deploy (idempotent)..."

case "$PRISMA_BIN" in
  *.js)
    exec node "$PRISMA_BIN" migrate deploy
    ;;
  *)
    exec "$PRISMA_BIN" migrate deploy
    ;;
esac
