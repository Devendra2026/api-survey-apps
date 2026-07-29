#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing restore: set CONFIRM=yes after verifying the target is correct." >&2
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: CONFIRM=yes DATABASE_URL=... $0 <postgres.dump|postgres.dump.gz>" >&2
  exit 1
fi

RESTORE_FILE="$BACKUP_FILE"
TMP_FILE=""

cleanup() {
  if [[ -n "$TMP_FILE" && -f "$TMP_FILE" ]]; then
    rm -f "$TMP_FILE"
  fi
}
trap cleanup EXIT

if [[ "$BACKUP_FILE" == *.gz ]]; then
  TMP_FILE="$(mktemp)"
  gunzip -c "$BACKUP_FILE" >"$TMP_FILE"
  RESTORE_FILE="$TMP_FILE"
fi

pg_restore "$RESTORE_FILE" \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

echo "Restored PostgreSQL from ${BACKUP_FILE}"
