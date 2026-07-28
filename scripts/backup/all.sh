#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
RUN_ID="$(date -u +%H%M%SZ)"
DIR="${BACKUP_ROOT}/${DAY}/${RUN_ID}"

mkdir -p "${BACKUP_ROOT}/${DAY}"
if ! mkdir "$DIR"; then
  echo "Backup run directory already exists: ${DIR}" >&2
  exit 1
fi

export BACKUP_ROOT
export BACKUP_RUN_DIR="$DIR"

"${SCRIPT_DIR}/postgres.sh"
"${SCRIPT_DIR}/redis.sh"
"${SCRIPT_DIR}/minio.sh"

printf 'completed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"${DIR}/.complete.tmp"
mv "${DIR}/.complete.tmp" "${DIR}/.complete"

echo "Backup complete: ${DIR}/"
echo "Copy it off-host with one of:"
printf '  rsync -avz %q/ user@offsite:/path/\n' "$DIR"
printf '  scp -r %q/ user@offsite:/path/\n' "$DIR"
