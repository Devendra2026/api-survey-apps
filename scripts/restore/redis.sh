#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing restore: set CONFIRM=yes after stopping Redis and verifying the target." >&2
  exit 1
fi

: "${REDIS_DATA_DIR:?REDIS_DATA_DIR is required and must point to the stopped Redis data volume}"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: CONFIRM=yes REDIS_DATA_DIR=/path/to/data $0 <redis.rdb>" >&2
  exit 1
fi

if [[ ! -d "$REDIS_DATA_DIR" ]]; then
  echo "Redis data directory does not exist: ${REDIS_DATA_DIR}" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -e "${REDIS_DATA_DIR}/appendonlydir" ]]; then
  mv "${REDIS_DATA_DIR}/appendonlydir" \
    "${REDIS_DATA_DIR}/appendonlydir.pre-restore-${TIMESTAMP}"
fi
if [[ -e "${REDIS_DATA_DIR}/dump.rdb" ]]; then
  mv "${REDIS_DATA_DIR}/dump.rdb" \
    "${REDIS_DATA_DIR}/dump.rdb.pre-restore-${TIMESTAMP}"
fi

cp "$BACKUP_FILE" "${REDIS_DATA_DIR}/dump.rdb"
chmod 600 "${REDIS_DATA_DIR}/dump.rdb"

echo "Installed ${BACKUP_FILE} as ${REDIS_DATA_DIR}/dump.rdb"
echo "Start Redis and verify the restored keys before removing pre-restore files."
