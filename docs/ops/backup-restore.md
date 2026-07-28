# Backup and restore

Aggregate runs create an isolated UTC backup set under
`${BACKUP_ROOT:-/backups}/YYYY-MM-DD/HHMMSSZ/`:

- `postgres-HHMMSSZ.dump.gz`: compressed PostgreSQL custom-format dump.
- `redis-HHMMSSZ.rdb`: Redis point-in-time RDB export.
- `minio/`: mirrored contents of `MINIO_BUCKET`.
- `.complete`: written only after all three component backups succeed.

Run the scripts from a host or utility container that has Bash, PostgreSQL
client tools, `redis-cli`, MinIO Client (`mc`), and access to each service.
Restrict access to `BACKUP_ROOT`; the artifacts contain production data.

## Create a complete backup

On the Dokploy host, export the real credentials or inject them from the
platform's secret environment. Then run:

```bash
BACKUP_ROOT=/backups \
DATABASE_URL='postgresql://...' \
REDIS_URL='redis://:password@redis:6379' \
MINIO_ENDPOINT='http://minio:9000' \
MINIO_ROOT_USER='...' \
MINIO_ROOT_PASSWORD='...' \
MINIO_BUCKET='api-survey-app' \
  bash scripts/backup/all.sh
```

`scripts/backup/all.sh` runs PostgreSQL, Redis, then MinIO backup scripts.
Each component can also be run independently:

```bash
bash scripts/backup/postgres.sh
bash scripts/backup/redis.sh
bash scripts/backup/minio.sh
```

The legacy `scripts/ops/backup-pg.sh` wrapper maps `BACKUP_DIR` to
`BACKUP_ROOT` when `BACKUP_ROOT` is unset; `BACKUP_ROOT` takes precedence.

If `REDIS_URL` is unavailable, the Redis script accepts `REDIS_PASSWORD` plus
optional `REDIS_HOST` and `REDIS_PORT`. The production Redis service uses AOF;
a stopped-volume snapshot of its data volume is an alternative to the RDB
export when the Dokploy host's snapshot tooling provides crash-consistent
snapshots.

## Copy every backup off-host

Keeping only the Dokploy volume copy is not a backup strategy. After every
run, copy the completed run directory to independently managed storage:

```bash
rsync -avz /backups/YYYY-MM-DD/HHMMSSZ/ user@offsite:/path/
# or
scp -r /backups/YYYY-MM-DD/HHMMSSZ/ user@offsite:/path/
```

Verify transfer success and periodically compare checksums at the destination.

## Restore

Every restore script refuses to run unless `CONFIRM=yes`. Do restore drills
against disposable targets. Never point a drill at production.

Restore a complete dated set with:

```bash
# Stop Redis before this command. REDIS_DATA_DIR must be its mounted data volume.
CONFIRM=yes \
BACKUP_ROOT=/backups \
DATABASE_URL='postgresql://throwaway-target/...' \
REDIS_DATA_DIR='/path/to/stopped/redis-data' \
MINIO_ENDPOINT='http://scratch-minio:9000' \
MINIO_ROOT_USER='...' \
MINIO_ROOT_PASSWORD='...' \
MINIO_BUCKET='api-survey-app-restore' \
  bash scripts/restore/all.sh /backups/YYYY-MM-DD
```

Given a day directory, aggregate restore selects its newest run containing a
`.complete` marker. An exact completed run directory can be passed instead.
It refuses incomplete aggregate sets and preflights every required variable,
tool, and artifact before invoking any destructive component restore.
Individual restore commands remain available:

```bash
CONFIRM=yes DATABASE_URL='postgresql://...' \
  bash scripts/restore/postgres.sh /backups/YYYY-MM-DD/HHMMSSZ/postgres-HHMMSSZ.dump.gz

# Redis must be stopped. Existing dump.rdb and appendonlydir are retained with
# a .pre-restore-<timestamp> suffix before the selected RDB is installed.
CONFIRM=yes REDIS_DATA_DIR='/path/to/stopped/redis-data' \
  bash scripts/restore/redis.sh /backups/YYYY-MM-DD/HHMMSSZ/redis-HHMMSSZ.rdb

CONFIRM=yes MINIO_ENDPOINT='http://scratch-minio:9000' \
MINIO_ROOT_USER='...' MINIO_ROOT_PASSWORD='...' \
MINIO_BUCKET='api-survey-app-restore' \
  bash scripts/restore/minio.sh /backups/YYYY-MM-DD/HHMMSSZ/minio
```

The MinIO restore overwrites matching objects but does not remove unrelated
objects already in the target bucket. Use a new or empty bucket for an exact
restore drill.

## Monthly restore drill

1. Copy a dated backup set from off-host storage to the drill host.
2. Restore PostgreSQL into a throwaway database and compare `Survey`, `User`,
   and `ImportJob` counts.
3. Restore Redis into a stopped throwaway data volume, start Redis, and sample
   keys and TTLs.
4. Restore MinIO into a scratch bucket and verify sample `Photo.objectKey`
   objects.
5. Start temporary API and worker services and check the readiness endpoint.
6. Record the observed recovery time, findings, and backup timestamps.
7. Delete the temporary targets after the results are recorded.

For a production disaster, first freeze deploys and stop writers. Restore the
three stores, run migrations if required, restart API and worker services, and
verify readiness plus representative data before reopening traffic.
