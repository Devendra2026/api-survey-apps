#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  cd /app/packages/database
  pnpm exec prisma migrate deploy
  cd /app/apps/api
fi

exec "$@"
