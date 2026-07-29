#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BACKUP_ROOT:-}" && -n "${BACKUP_DIR:-}" ]]; then
  export BACKUP_ROOT="$BACKUP_DIR"
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../backup/postgres.sh" "$@"
