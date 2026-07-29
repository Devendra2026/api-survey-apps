#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_RUN_DIR:-${BACKUP_ROOT}/${DAY}}"

: "${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p "$DIR"
OUT="${DIR}/postgres-$(date -u +%H%M%SZ).dump"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$OUT"
gzip -f "$OUT"

echo "Wrote ${OUT}.gz"
