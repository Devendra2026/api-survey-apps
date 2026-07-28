#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_RUN_DIR:-${BACKUP_ROOT}/${DAY}}"
OUT="${DIR}/minio"

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${MINIO_BUCKET:?MINIO_BUCKET is required}"

mkdir -p "$OUT"

mc alias set backup-source \
  "$MINIO_ENDPOINT" \
  "$MINIO_ROOT_USER" \
  "$MINIO_ROOT_PASSWORD" \
  >/dev/null
mc mirror --overwrite "backup-source/${MINIO_BUCKET}/" "${OUT}/"

echo "Wrote ${OUT}/"
