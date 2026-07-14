#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required to run migrations" >&2
  exit 1
fi

cd /app/packages/database
pnpm exec prisma migrate deploy
