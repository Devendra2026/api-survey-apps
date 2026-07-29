### Task 7: Backup and restore scripts

**Files:**

- Create: `scripts/backup/postgres.sh`, `scripts/backup/redis.sh`, `scripts/backup/minio.sh`, `scripts/backup/all.sh`
- Create: `scripts/restore/postgres.sh`, `scripts/restore/redis.sh`, `scripts/restore/minio.sh`, `scripts/restore/all.sh`
- Modify: `scripts/ops/backup-pg.sh`, `scripts/ops/restore-pg.sh` → wrappers calling new scripts
- Modify: `docs/ops/backup-restore.md`

**Interfaces:**

- Produces: `/backups/YYYY-MM-DD/` artifacts; Dokploy one-command `scripts/backup/all.sh`

- [ ] **Step 1: Implement postgres backup**

`scripts/backup/postgres.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_ROOT}/${DAY}"
mkdir -p "$DIR"
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT="${DIR}/postgres-$(date -u +%H%M%SZ).dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUT"
gzip -f "$OUT"
echo "Wrote ${OUT}.gz"
```

- [ ] **Step 2: Implement redis backup**

Use `redis-cli` with `REDIS_PASSWORD` / `REDIS_URL`:

```bash
# BGSAVE or --rdb copy; store under ${DIR}/redis-*.rdb
```

Document that AOF volume snapshot is an alternative on the Dokploy host.

- [ ] **Step 3: Implement minio backup**

```bash
# mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
# mc mirror --overwrite local/"$MINIO_BUCKET" "${DIR}/minio/"
```

- [ ] **Step 4: Wire `all.sh` + restore counterparts**

`scripts/backup/all.sh` runs postgres → redis → minio and prints:

```text
rsync -avz /backups/YYYY-MM-DD/ user@offsite:/path/
# or scp -r ...
```

Restore scripts reverse the operations with explicit “never overwrite prod without confirmation” guards (`CONFIRM=yes` required).

- [ ] **Step 5: Rewrite `docs/ops/backup-restore.md`**

Document single Dokploy command:

```bash
BACKUP_ROOT=/backups DATABASE_URL=... REDIS_PASSWORD=... MINIO_ENDPOINT=... \
  bash scripts/backup/all.sh
```

- [ ] **Step 6: Make executable and commit**

```bash
git add scripts/backup scripts/restore scripts/ops/backup-pg.sh scripts/ops/restore-pg.sh docs/ops/backup-restore.md
git commit -m "feat(ops): add postgres redis minio backup and restore scripts"
```

---
