# Production go-live (Dokploy + Docker Postgres/MinIO/Redis)

## What is already done in the repo

- `docker-compose.dokploy.yml` — builds web/api/worker + Docker Postgres, MinIO, Redis (no root Dockerfile)
- Env templates: [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example), [`dokploy-env.md`](./dokploy-env.md)
- Migrations fail fast if `REPLACE_ME` is still in `DATABASE_URL`
- Release workflow can push to ECR later (optional); first launch uses compose **build**

## Blockers only you can clear

1. **Infra + app secrets** in Dokploy Environment UI  
   Paste [`dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example).  
   Interpolation-required: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `DATABASE_URL`.  
   Runtime: Clerk, `NEXT_PUBLIC_*`, `CORS_ORIGIN` / `APP_URL` (host `postgres` in DB URLs).

2. **DNS + TLS in Dokploy**
   - `admin.sdvedutech.in` → service `web` container port **3000**
   - `backend.sdvedutech.in` → service `api` container port **4000**
   - Worker listens on `4001` and remains internal
   - Clerk allowed origins / redirect URLs include `https://admin.sdvedutech.in`

3. **EC2 security group** — expose only TCP `80`/`443` for Traefik. Do not allow public inbound access to application ports `3001`, `4000`, or `4001`.

## Dokploy deploy steps

0. **App type must be Docker Compose** — if you see `open Dockerfile: no such file`, follow [`dokploy-compose-setup.md`](./dokploy-compose-setup.md). Do **not** add a root Dockerfile.
1. Paste [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example) into Dokploy **Environment** (replace all `REPLACE_ME_*`). Missing `MINIO_ROOT_USER` / `POSTGRES_PASSWORD` / etc. fails compose interpolation before start.
2. Confirm `DATABASE_URL` host is `postgres` (not localhost). Deploy Compose file `docker-compose.dokploy.yml`, context = repo root.
3. Wait for `postgres` / `minio` / `redis` healthy, `migrate` success (migrate also runs **catalog seed**: roles, permissions, reference catalogs, sample Etah geo), then `api` `/health` + `/ready`, then `web`.
4. Set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` to your Clerk user id (`user_…` from Clerk Dashboard → Users) **before or right after** first sign-in, then redeploy/restart **api**.
5. Open `https://admin.sdvedutech.in`, sign in, and click **Refresh profile** if you still see Pending User.

### First admin stuck on “Pending User”

Chicken-and-egg: without bootstrap, the first signup gets `PENDING_APPROVAL` (0 permissions). Fix:

1. Copy your Clerk user id into Dokploy env: `BOOTSTRAP_ADMIN_CLERK_USER_IDS=user_xxxxx`
2. Redeploy so **api** picks up the env (and **migrate** re-runs catalog seed if the image includes the seed entrypoint).
3. Click **Refresh profile** on the Pending User screen — bootstrap now promotes `PENDING_APPROVAL` → `ADMIN`.

Optional: `SKIP_DB_SEED=true` skips catalog seed on migrate; `SEED_DEMO=true` also seeds demo users/surveys (not for production).

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
