#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_ROOT}/${DAY}"

export BACKUP_ROOT

"${SCRIPT_DIR}/postgres.sh"
"${SCRIPT_DIR}/redis.sh"
"${SCRIPT_DIR}/minio.sh"

echo "Backup complete: ${DIR}/"
echo "Copy it off-host with one of:"
printf '  rsync -avz %q/ user@offsite:/path/\n' "$DIR"
printf '  scp -r %q/ user@offsite:/path/\n' "$DIR"
