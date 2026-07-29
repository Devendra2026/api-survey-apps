#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

mkdir -p "${TMP}/bin" "${TMP}/backups"

cat >"${TMP}/bin/pg_dump" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do
  case "$arg" in
    --file=*) printf 'postgres' >"${arg#--file=}" ;;
  esac
done
EOF

cat >"${TMP}/bin/redis-cli" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
while (($#)); do
  if [[ "$1" == "--rdb" ]]; then
    printf 'redis' >"$2"
    exit 0
  fi
  shift
done
exit 1
EOF

cat >"${TMP}/bin/mc" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "alias" ]]; then
  exit 0
fi
if [[ "$1" == "mirror" ]]; then
  mkdir -p "${@: -1}"
  printf 'object' >"${@: -1}/object"
fi
EOF

cat >"${TMP}/bin/pg_restore" <<EOF
#!/usr/bin/env bash
printf 'mutated\n' >>"${TMP}/pg-restore.log"
EOF

chmod +x "${TMP}/bin/"*
export PATH="${TMP}/bin:${PATH}"

BACKUP_ROOT="${TMP}/backups" \
DATABASE_URL="postgresql://backup" \
REDIS_URL="redis://backup" \
MINIO_ENDPOINT="http://minio" \
MINIO_ROOT_USER="user" \
MINIO_ROOT_PASSWORD="password" \
MINIO_BUCKET="bucket" \
  bash "${ROOT}/scripts/backup/all.sh"

DAY_DIR="${TMP}/backups/$(date -u +%Y-%m-%d)"
shopt -s nullglob
RUN_DIRS=("${DAY_DIR}"/*/)
shopt -u nullglob
(( ${#RUN_DIRS[@]} == 1 )) || fail "aggregate backup did not create one run directory"
RUN_DIR="${RUN_DIRS[0]}"
[[ -f "${RUN_DIR}/.complete" ]] || fail "aggregate backup did not mark the run complete"
compgen -G "${RUN_DIR}/postgres-*.dump.gz" >/dev/null || fail "run lacks PostgreSQL artifact"
compgen -G "${RUN_DIR}/redis-*.rdb" >/dev/null || fail "run lacks Redis artifact"
[[ -d "${RUN_DIR}/minio" ]] || fail "run lacks MinIO artifact"

set +e
CONFIRM=yes \
BACKUP_ROOT="${TMP}/backups" \
DATABASE_URL="postgresql://restore" \
  bash "${ROOT}/scripts/restore/all.sh" "$DAY_DIR" >/dev/null 2>&1
STATUS=$?
set -e

(( STATUS != 0 )) || fail "restore accepted missing required environment"
[[ ! -e "${TMP}/pg-restore.log" ]] || fail "restore mutated PostgreSQL before preflight completed"

LEGACY_ROOT="${TMP}/legacy"
BACKUP_DIR="$LEGACY_ROOT" \
DATABASE_URL="postgresql://backup" \
  bash "${ROOT}/scripts/ops/backup-pg.sh"
compgen -G "${LEGACY_ROOT}/$(date -u +%Y-%m-%d)/postgres-*.dump.gz" >/dev/null ||
  fail "BACKUP_DIR was not mapped to BACKUP_ROOT"

echo "Backup/restore regression checks passed."
