#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing restore: set CONFIRM=yes after stopping services and verifying every target." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
REQUESTED_DIR="${1:-${BACKUP_ROOT}/${DAY}}"

fail() {
  echo "$*" >&2
  exit 1
}

for name in DATABASE_URL REDIS_DATA_DIR MINIO_ENDPOINT MINIO_ROOT_USER MINIO_ROOT_PASSWORD MINIO_BUCKET; do
  if [[ -z "${!name:-}" ]]; then
    fail "${name} is required"
  fi
done

for tool in pg_restore redis-cli mc; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    fail "Required restore tool is unavailable: ${tool}"
  fi
done

if [[ ! -d "$REQUESTED_DIR" ]]; then
  fail "Backup directory does not exist: ${REQUESTED_DIR}"
fi

if [[ -f "${REQUESTED_DIR}/.complete" ]]; then
  DIR="$REQUESTED_DIR"
else
  shopt -s nullglob
  COMPLETED_RUNS=("${REQUESTED_DIR}"/*/.complete)
  shopt -u nullglob

  if (( ${#COMPLETED_RUNS[@]} == 0 )); then
    fail "No completed backup run found under ${REQUESTED_DIR}"
  fi

  LATEST_MANIFEST="${COMPLETED_RUNS[${#COMPLETED_RUNS[@]} - 1]}"
  DIR="$(dirname -- "$LATEST_MANIFEST")"
fi

shopt -s nullglob
POSTGRES_FILES=("${DIR}"/postgres-*.dump "${DIR}"/postgres-*.dump.gz)
REDIS_FILES=("${DIR}"/redis-*.rdb)
shopt -u nullglob

if (( ${#POSTGRES_FILES[@]} != 1 )); then
  fail "Expected exactly one PostgreSQL backup under ${DIR}; found ${#POSTGRES_FILES[@]}"
fi
if (( ${#REDIS_FILES[@]} != 1 )); then
  fail "Expected exactly one Redis backup under ${DIR}; found ${#REDIS_FILES[@]}"
fi
if [[ ! -d "${DIR}/minio" ]]; then
  fail "No MinIO backup found under ${DIR}/minio"
fi
if [[ ! -d "$REDIS_DATA_DIR" ]]; then
  fail "Redis data directory does not exist: ${REDIS_DATA_DIR}"
fi

POSTGRES_FILE="${POSTGRES_FILES[0]}"
REDIS_FILE="${REDIS_FILES[0]}"

"${SCRIPT_DIR}/postgres.sh" "$POSTGRES_FILE"
"${SCRIPT_DIR}/redis.sh" "$REDIS_FILE"
"${SCRIPT_DIR}/minio.sh" "${DIR}/minio"

echo "Restore completed from ${DIR}/"
