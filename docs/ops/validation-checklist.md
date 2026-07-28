# Production validation checklist

Use after first Dokploy deploy with `docker-compose.dokploy.yml`.

## Host / data plane

- [ ] Postgres, MinIO, Redis containers healthy
- [ ] Docker volumes present: `survey_pg_data_prod`, `survey_minio_data_prod`, `survey_redis_data_prod`
- [ ] Postgres and MinIO not published publicly (compose keeps them on the internal `app` network)
- [ ] Strong `POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `MINIO_ROOT_*` set in Dokploy Environment
- [ ] Secrets only in Dokploy (Dokploy `.env` on host; never commit real passwords)
- [ ] TLS terminates at Dokploy / reverse proxy for `admin` and `backend` domains

## Application

- [ ] `GET /health` and `GET /ready` succeed on API (`ready` shows database, redis, storage up)
- [ ] Web loads at app domain; Clerk sign-in works
- [ ] Photo upload + download (presigned URL via MinIO)
- [ ] Excel import enqueues and worker completes
- [ ] Export job completes and download works
- [ ] Prisma migrate ran via Dokploy `migrate` service / `DIRECT_URL`

## Ops

- [ ] Host disk monitoring for Docker volume growth
- [ ] Backup schedule for Postgres dump + MinIO volume ([backup-restore.md](./backup-restore.md))
- [ ] Restore drill documented once
- [ ] Optional: CI release to ECR + Dokploy webhook succeeds
- [ ] Rollback to previous image/git revision verified
