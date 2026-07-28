#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_RUN_DIR:-${BACKUP_ROOT}/${DAY}}"
OUT="${DIR}/redis-$(date -u +%H%M%SZ).rdb"

if [[ -n "${REDIS_URL:-}" ]]; then
  mkdir -p "$DIR"
  redis-cli -u "$REDIS_URL" --rdb "$OUT"
else
  : "${REDIS_PASSWORD:?Set REDIS_URL or REDIS_PASSWORD}"
  mkdir -p "$DIR"
  REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli \
    -h "${REDIS_HOST:-localhost}" \
    -p "${REDIS_PORT:-6379}" \
    --rdb "$OUT"
fi

echo "Wrote ${OUT}"
