# Backup and restore drill

## What is backed up

| Asset         | Mechanism                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Postgres      | Docker volume `survey_pg_data_prod` — periodic `pg_dump` or volume snapshot on the Dokploy host |
| MinIO objects | Docker volume `survey_minio_data_prod` — `mc mirror` or volume snapshot                         |
| Redis         | Docker volume `survey_redis_data_prod` — AOF enabled; jobs also tracked in Postgres             |

## Monthly restore drill

1. Take a `pg_dump` (or volume snapshot) of production Postgres.
2. Restore into a throwaway Postgres container / volume (never overwrite prod in-place for drills).
3. Point a temporary `DATABASE_URL` at the restore and smoke-query `Survey`, `User`, `ImportJob` counts.
4. Optionally restore MinIO volume or `mc mirror` into a scratch bucket and verify a sample `Photo.objectKey`.
5. Delete the throwaway restore after the drill.
6. Record RTO observed in the ops log.

### Example dump / restore

```bash
# dump (from host or postgres container)
docker compose -f docker-compose.dokploy.yml exec -T postgres \
  pg_dump -U postgres survey > survey-$(date +%F).sql

# restore into a temporary instance
psql "$TEMP_DATABASE_URL" < survey-YYYY-MM-DD.sql
```

## Production disaster restore

1. Freeze Dokploy deploys.
2. Restore Postgres volume or `pg_dump` into the compose `postgres` service.
3. Restore MinIO volume if objects were lost.
4. Restart `migrate` (if needed), then `api` + `worker`.
5. Confirm `GET https://backend.../ready` (database + redis + storage).

## Off-host copies

Copy dump files / volume snapshots off the Dokploy VM (object storage, another disk, or backup appliance). Day-1 does not require a second region.
