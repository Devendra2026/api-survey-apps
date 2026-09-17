#!/usr/bin/env bash
# Read-only Dokploy / Docker host disk diagnosis for ENOSPC.
# Run on the production Dokploy server BEFORE any cleanup or redeploy.
# Does NOT modify volumes, containers, images, or build cache.
set -euo pipefail

echo "=== filesystems ==="
df -h
echo
echo "=== inodes (same ENOSPC if IUse%=100) ==="
df -i
echo

echo "=== docker daemon ==="
docker info 2>/dev/null | sed -n \
  -e '/Docker Root Dir/,/Containerd/p' \
  -e '/Storage Driver/,/Logging Driver/p' \
  -e '/overlay/p' || docker info
echo

echo "=== docker disk usage ==="
docker system df
echo
docker system df -v
echo

echo "=== PRODUCTION VOLUMES (must exist; do not remove) ==="
docker volume ls
echo
docker volume ls | grep -E 'survey_(pg|redis|minio)_data_prod' || {
  echo "WARNING: expected survey_*_data_prod volumes not found by name filter" >&2
}
echo

echo "=== volume mountpoints / sizes (read-only) ==="
for vol in survey_pg_data_prod survey_redis_data_prod survey_minio_data_prod; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    docker volume inspect "$vol" --format "{{.Name}} mount={{.Mountpoint}} created={{.CreatedAt}}"
  else
    # Dokploy may prefix project name — list matches
    echo "Exact name '$vol' not found; matching volumes:"
    docker volume ls -q | grep -E "survey_(pg|redis|minio)_data_prod" || true
  fi
done
echo

echo "=== running vs stopped ==="
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Size}}'
echo

echo "=== images ==="
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}\t{{.CreatedSince}}'
echo

echo "=== large dirs on docker/containerd/dokploy (read-only) ==="
du -xh --max-depth=2 /var/lib/docker 2>/dev/null | sort -h | tail -n 30 || true
du -xh --max-depth=2 /var/lib/containerd 2>/dev/null | sort -h | tail -n 20 || true
du -xh --max-depth=2 /etc/dokploy /var/lib/dokploy 2>/dev/null | sort -h | tail -n 20 || true

echo
echo "=== decision checklist ==="
echo "1) Note which mount is full (Avail / Use% on df -h)."
echo "2) Check inode exhaustion (IUse% on df -i)."
echo "3) Confirm survey_*_data_prod volumes still listed."
echo "4) Redeploy only when Docker Root filesystem has ~>=15 GiB free (min ~10 GiB)."
echo "5) If Postgres/MinIO volumes already fill the disk, expand the disk — do NOT delete prod data."
echo
echo "Next (safe cleanup only): bash scripts/ops/dokploy-safe-prune.sh"
