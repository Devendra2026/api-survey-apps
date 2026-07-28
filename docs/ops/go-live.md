# Production go-live (Dokploy + Docker Postgres/MinIO/Redis)

## What is already done in the repo

- `docker-compose.dokploy.yml` — builds web/api/worker + Docker Postgres, MinIO, Redis (no root Dockerfile)
- Env templates: [`dokploy-env.md`](./dokploy-env.md), [`deploy/env/*.env.example`](../../deploy/env/)
- Migrations fail fast if `REPLACE_ME` is still in `DATABASE_URL`
- Release workflow can push to ECR later (optional); first launch uses compose **build**

## Blockers only you can clear

1. **Infra + app secrets** in Dokploy Environment UI  
   Required: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.  
   Also set `DATABASE_URL` / `DIRECT_URL` (same password as Postgres), Clerk keys, and `NEXT_PUBLIC_*`.

2. **DNS + TLS in Dokploy**
   - `admin.sdvedutech.in` → service `web` container port **3000** (host map is `3001→3000`)
   - `backend.sdvedutech.in` → service `api` container port **4000**
   - Worker listens on `4001` (internal; open SG if you need direct access)
   - Clerk allowed origins / redirect URLs include `https://admin.sdvedutech.in`

3. **EC2 security group** — allow inbound TCP `3001`, `4000`, `4001` (plus `80`/`443` for the proxy):

```powershell
# Configure AWS credentials first, then:
.\scripts\ops\open-dokploy-ports.ps1
```

Or manually:

```bash
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 3001 --cidr 0.0.0.0/0 --region ap-south-1
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region ap-south-1
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 4001 --cidr 0.0.0.0/0 --region ap-south-1
```

(Previous Dokploy host SG was `sg-02d37ca2cd71ed334` on `13.127.204.141`.)

## Dokploy deploy steps

0. **App type must be Docker Compose** — if you see `open Dockerfile: no such file`, follow [`dokploy-compose-setup.md`](./dokploy-compose-setup.md) (recreate `sdv-dashboard-jpnilc` as Compose). Do **not** add a root Dockerfile.
1. Paste the env matrix from [dokploy-env.md](./dokploy-env.md) (or `deploy/env/*.env.example`) into Dokploy **Environment** (after setting strong passwords). `DATABASE_URL` host = `postgres`. Dokploy writes `.env`; compose loads it.
2. Deploy as Build type **Docker Compose**, file `docker-compose.dokploy.yml`, context = repo root.
3. Wait for `postgres` / `minio` / `redis` healthy, `migrate` success, then `api` `/health` + `/ready`, then `web`.
4. Open `https://admin.sdvedutech.in` and sign in with Clerk.
5. Optional: set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` to your Clerk user id, redeploy once.

## Smoke test

```bash
curl -fsS https://backend.sdvedutech.in/health
curl -fsS https://backend.sdvedutech.in/ready
curl -fsSI https://admin.sdvedutech.in/
```

## After first successful deploy

- Rotate Clerk / Maps keys that were shared earlier.
- Optional: switch images to ECR via release workflow.
- Schedule volume backups ([backup-restore.md](./backup-restore.md)).

## ETL (Convex → Postgres / MinIO) checklist

Only if live Convex survey sync is still required:

1. On self-hosted Convex: set `ETL_SECRET` (shared secret).
2. On Dokploy **api** and **worker** env: set `CONVEX_SITE_URL`, `ETL_CONVEX_SECRET` (= Convex `ETL_SECRET`), and on api `ETL_ENABLED=true` (optional cron).
3. Confirm worker is running (BullMQ consumers).
4. Seed geo catalog (Master Data → Tenants & Wards) before first sync.
5. Sign in as ADMIN (`etl:manage`) → Master Data → **Sync from Convex**, or open **Administration → ETL Sync**.
6. Confirm surveys in Postgres and photos under MinIO `etah-images/…` (see [ETL RUNBOOK](../etl/RUNBOOK.md)).
