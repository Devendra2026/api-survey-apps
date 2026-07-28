#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing restore: set CONFIRM=yes after stopping services and verifying every target." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${1:-${BACKUP_ROOT}/${DAY}}"

if [[ ! -d "$DIR" ]]; then
  echo "Backup directory does not exist: ${DIR}" >&2
  exit 1
fi

shopt -s nullglob
POSTGRES_FILES=("${DIR}"/postgres-*.dump "${DIR}"/postgres-*.dump.gz)
REDIS_FILES=("${DIR}"/redis-*.rdb)
shopt -u nullglob

if (( ${#POSTGRES_FILES[@]} == 0 )); then
  echo "No PostgreSQL backup found under ${DIR}" >&2
  exit 1
fi
if (( ${#REDIS_FILES[@]} == 0 )); then
  echo "No Redis backup found under ${DIR}" >&2
  exit 1
fi
if [[ ! -d "${DIR}/minio" ]]; then
  echo "No MinIO backup found under ${DIR}/minio" >&2
  exit 1
fi

POSTGRES_FILE="${POSTGRES_FILES[${#POSTGRES_FILES[@]} - 1]}"
REDIS_FILE="${REDIS_FILES[${#REDIS_FILES[@]} - 1]}"

"${SCRIPT_DIR}/postgres.sh" "$POSTGRES_FILE"
"${SCRIPT_DIR}/redis.sh" "$REDIS_FILE"
"${SCRIPT_DIR}/minio.sh" "${DIR}/minio"

echo "Restore completed from ${DIR}/"
