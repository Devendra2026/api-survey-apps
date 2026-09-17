#!/usr/bin/env bash
# Safe Docker cleanup for Dokploy ENOSPC — NEVER touches named volumes.
# Forbidden: volume prune, volume rm, system prune --volumes, compose down -v.
set -euo pipefail

REQUIRED_PATTERNS=(
  'survey_pg_data_prod'
  'survey_redis_data_prod'
  'survey_minio_data_prod'
)

echo "=== gate: production volumes must exist ==="
VOL_LIST="$(docker volume ls)"
echo "$VOL_LIST"
echo

missing=0
for pat in "${REQUIRED_PATTERNS[@]}"; do
  if ! echo "$VOL_LIST" | grep -q "$pat"; then
    echo "ABORT: volume matching '$pat' not found. Refusing cleanup." >&2
    missing=1
  else
    echo "OK: found volume matching $pat"
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi
echo

echo "=== before ==="
df -h | head -n 20
docker system df
echo

echo "=== 1) BuildKit / builder cache only ==="
docker builder prune -f
echo

# Optional aggressive unused build cache (still does not touch volumes).
if [ "${AGGRESSIVE:-0}" = "1" ]; then
  echo "=== AGGRESSIVE=1: docker builder prune -af ==="
  docker builder prune -af
  echo
fi

echo "=== 2) Stopped containers only (migrate / minio-init leftovers) ==="
docker container prune -f
echo

echo "=== 3) Dangling images only (untagged) ==="
docker image prune -f
echo

echo "=== after ==="
df -h | head -n 20
df -i | head -n 20
docker system df
echo

echo "=== re-confirm production volumes (unchanged) ==="
docker volume ls | grep -E 'survey_(pg|redis|minio)_data_prod' || {
  echo "ERROR: production volume names missing after prune — investigate immediately" >&2
  exit 1
}

echo
echo "Safe prune complete. Do NOT run: docker volume prune | docker system prune --volumes | docker compose down -v"
echo "If free space is still <10 GiB on Docker Root, expand the disk or remove unused OLD app image tags after verifying they are not in use (docker images / docker ps)."
