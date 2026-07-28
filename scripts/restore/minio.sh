#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing restore: set CONFIRM=yes after verifying the target bucket." >&2
  exit 1
fi

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${MINIO_BUCKET:?MINIO_BUCKET is required}"

BACKUP_DIR="${1:-}"
if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "Usage: CONFIRM=yes MINIO_ENDPOINT=... MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=... MINIO_BUCKET=... $0 <minio-directory>" >&2
  exit 1
fi

mc alias set restore-target \
  "$MINIO_ENDPOINT" \
  "$MINIO_ROOT_USER" \
  "$MINIO_ROOT_PASSWORD" \
  >/dev/null
mc mb --ignore-existing "restore-target/${MINIO_BUCKET}" >/dev/null
mc mirror --overwrite "${BACKUP_DIR}/" "restore-target/${MINIO_BUCKET}/"

echo "Restored MinIO objects from ${BACKUP_DIR}/ to ${MINIO_BUCKET}"
