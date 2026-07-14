#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL restore helper for custom-format backups from backup-pg.sh.
# Windows users: run from Git Bash or WSL so bash, gunzip, and pg_restore are available.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" ./scripts/ops/restore-pg.sh ./backups/file.dump.gz
#
# This is intentionally explicit because restore is destructive when --clean is set.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

backup_file="${1:-}"
if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
  echo "Usage: $0 <backup.dump|backup.dump.gz>" >&2
  exit 1
fi

tmp_file=""
restore_file="$backup_file"
if [[ "$backup_file" == *.gz ]]; then
  tmp_file="$(mktemp)"
  gunzip -c "$backup_file" > "$tmp_file"
  restore_file="$tmp_file"
fi

cleanup() {
  if [[ -n "$tmp_file" && -f "$tmp_file" ]]; then
    rm -f "$tmp_file"
  fi
}
trap cleanup EXIT

echo "Restoring ${backup_file} into DATABASE_URL target"
pg_restore "$restore_file" --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges
echo "Restore complete"
