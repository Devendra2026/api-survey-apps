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
pnpm exec prisma migrate deploy
