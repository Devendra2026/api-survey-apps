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
esac

cd /app/packages/database
# Runner image has no pnpm; call the Prisma CLI binary directly.
if [ -x /app/node_modules/.bin/prisma ]; then
  exec /app/node_modules/.bin/prisma migrate deploy
elif [ -x ./node_modules/.bin/prisma ]; then
  exec ./node_modules/.bin/prisma migrate deploy
else
  echo "Prisma CLI not found under node_modules/.bin" >&2
  exit 1
fi
