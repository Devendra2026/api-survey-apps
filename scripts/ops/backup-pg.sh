#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL backup helper.
# Windows users: run from Git Bash or WSL so bash, pg_dump, and gzip are available.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" ./scripts/ops/backup-pg.sh
#   BACKUP_DIR=./backups ./scripts/ops/backup-pg.sh

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="${BACKUP_DIR}/api-survey-${timestamp}.dump"

echo "Writing PostgreSQL custom-format backup to ${output}"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$output"
gzip -f "$output"
echo "Backup complete: ${output}.gz"
