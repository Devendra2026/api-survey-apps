# Dokploy environment variables (production)

Data plane runs **inside** the compose stack (Postgres 17, MinIO, Redis 8). Prefer Dokploy secrets for passwords — do not commit real values.

**Copy-paste block for Compose:** [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example)  
**UI steps:** [`dokploy-compose-setup.md`](./dokploy-compose-setup.md)

## How Dokploy injects env

1. Paste variables into the Compose app **Environment** UI.
2. Dokploy writes them to a `.env` file beside the compose file (used for `${VAR}` interpolation **and** for container injection).
3. [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml) loads that file on `migrate` / `api` / `worker` / `web` via `env_file: .env` (`required: false`).

If you see `required variable MINIO_ROOT_USER is missing a value` (or `POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `MINIO_ROOT_PASSWORD` / `DATABASE_URL`), the Environment UI is empty or incomplete — paste the block from `dokploy.compose.env.example` and redeploy.

## Checklist: interpolation vs runtime

### A — Mandatory for `docker compose up` (interpolation)

Compose uses `${VAR:?…}` — deploy **stops before containers start** if any are missing:

| Variable              | Used by                                                |
| --------------------- | ------------------------------------------------------ |
| `POSTGRES_PASSWORD`   | `postgres`                                             |
| `REDIS_PASSWORD`      | `redis`, composed `REDIS_URL` for api/worker           |
| `MINIO_ROOT_USER`     | `minio`, `minio-init`, api/worker                      |
| `MINIO_ROOT_PASSWORD` | `minio`, `minio-init`, api/worker                      |
| `DATABASE_URL`        | `migrate`, `api`, `worker` (`:?` required)             |
| `DIRECT_URL`          | preferred for `migrate` (falls back to `DATABASE_URL`) |

Safe defaults already in compose (no need to set unless overriding): `POSTGRES_USER`, `POSTGRES_DB`, `MINIO_BUCKET`.

### B — Mandatory for healthy app runtime / web build

| Variable                                                    | Where                                               |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL` / `DIRECT_URL`                               | host **`postgres`**, password = `POSTGRES_PASSWORD` |
| `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`                 | api (+ web server if used)                          |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`  | **web build args**                                  |
| `CLERK_AUTHORIZED_PARTIES`, `CORS_ORIGIN`, `APP_URL`        | production domains                                  |
| `BOOTSTRAP_ADMIN_CLERK_USER_IDS`                            | first production admin Clerk `user_…` id(s)         |
| `DEMAND_NOTICE_PRINT_SECRET`                                | api                                                 |
| `STORAGE_PROVIDER=minio`, `MINIO_BUCKET` / `STORAGE_BUCKET` | api/worker (endpoint overridden by compose)         |

`CLERK_SECRET_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_*`
name. `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and the
optional Maps key are compiled into the web image; changing them requires a
new web build, not only a container restart.

## Paste-ready minimal block

```bash
POSTGRES_PASSWORD=REPLACE_ME_POSTGRES_PASSWORD
REDIS_PASSWORD=REPLACE_ME_REDIS_PASSWORD_URL_SAFE
MINIO_ROOT_USER=REPLACE_ME_MINIO_USER
MINIO_ROOT_PASSWORD=REPLACE_ME_MINIO_PASSWORD

DATABASE_URL=postgresql://postgres:REPLACE_ME_POSTGRES_PASSWORD@postgres:5432/survey?schema=public
DIRECT_URL=postgresql://postgres:REPLACE_ME_POSTGRES_PASSWORD@postgres:5432/survey?schema=public

NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_ME
CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_ME
CLERK_SECRET_KEY=sk_live_REPLACE_ME
CLERK_AUTHORIZED_PARTIES=https://admin.sdvedutech.in
BOOTSTRAP_ADMIN_CLERK_USER_IDS=user_REPLACE_ME

CORS_ORIGIN=https://admin.sdvedutech.in
APP_URL=https://admin.sdvedutech.in
DEMAND_NOTICE_PRINT_SECRET=REPLACE_ME_LONG_RANDOM

STORAGE_PROVIDER=minio
MINIO_BUCKET=api-survey-app
STORAGE_BUCKET=api-survey-app
BACKUP_ROOT=/backups
NODE_ENV=production
```

Use a URL-safe `REDIS_PASSWORD` (avoid `@`, `:`, `/`). Do **not** set `REDIS_URL` in the Environment UI — compose builds it from `REDIS_PASSWORD` for api/worker.
`BACKUP_ROOT` is consumed by host-side backup/restore scripts; it is not an
application container variable. Restrict access because its artifacts contain
production data.

## Required (full table)

| Variable                            | Example / source                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                          | `production`                                                                                                                                                                                        |
| `POSTGRES_USER`                     | `postgres` (optional; default)                                                                                                                                                                      |
| `POSTGRES_PASSWORD`                 | Strong password (must match URLs below) — **required**                                                                                                                                              |
| `POSTGRES_DB`                       | `survey` (optional; default)                                                                                                                                                                        |
| `DATABASE_URL`                      | `postgresql://postgres:PASS@postgres:5432/survey?schema=public`                                                                                                                                     |
| `DIRECT_URL`                        | Same as `DATABASE_URL` for migrate                                                                                                                                                                  |
| `REDIS_PASSWORD`                    | Strong URL-safe password — **required**. Do **not** also set `REDIS_URL` in Dokploy Environment.                                                                                                    |
| `REDIS_URL`                         | **Compose-only** for api/worker: `redis://:${REDIS_PASSWORD}@redis:6379` (overrides env_file). Never paste a static `REDIS_URL` into Dokploy UI — a mismatched password causes Redis auth failures. |
| `STORAGE_PROVIDER`                  | `minio`                                                                                                                                                                                             |
| `MINIO_ROOT_USER`                   | Strong unique user — **required**                                                                                                                                                                   |
| `MINIO_ROOT_PASSWORD`               | Strong password — **required**                                                                                                                                                                      |
| `MINIO_ENDPOINT`                    | `http://minio:9000` (compose overrides for api/worker)                                                                                                                                              |
| `MINIO_BUCKET`                      | `api-survey-app`                                                                                                                                                                                    |
| `STORAGE_BUCKET`                    | Same as `MINIO_BUCKET`                                                                                                                                                                              |
| `CORS_ORIGIN`                       | `https://admin.sdvedutech.in`                                                                                                                                                                       |
| `APP_URL`                           | `https://admin.sdvedutech.in`                                                                                                                                                                       |
| `NEXT_PUBLIC_API_URL`               | `https://backend.sdvedutech.in` (**build arg** for web)                                                                                                                                             |
| `CLERK_SECRET_KEY`                  | Clerk dashboard                                                                                                                                                                                     |
| `CLERK_PUBLISHABLE_KEY`             | Clerk dashboard                                                                                                                                                                                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard (**build arg** for web)                                                                                                                                                             |
| `CLERK_AUTHORIZED_PARTIES`          | `https://admin.sdvedutech.in`                                                                                                                                                                       |
| `BOOTSTRAP_ADMIN_CLERK_USER_IDS`    | Clerk `user_…` ids, comma-separated; set before first sign-in                                                                                                                                       |
| `DEMAND_NOTICE_PRINT_SECRET`        | Strong random secret                                                                                                                                                                                |
| `BACKUP_ROOT`                       | Host backup path, normally `/backups`                                                                                                                                                               |

## Optional (recommended)

| Variable                          | Notes                                                           |
| --------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Web build arg; maps UI                                          |
| `WEB_HOST` / `API_HOST`           | Override Traefik Host rules                                     |
| `SEED_DEMO`                       | Only for **manual** `pnpm db:seed` — keep `false` in production |

### One-time catalog seed (not part of migrate)

`migrate` runs **`prisma migrate deploy` only**. Roles, permissions, reference catalogs, and sample geo are **not** applied by the migrate one-shot.

After the first successful migrate on an empty database (from a host that can reach Postgres, e.g. tunnel/VPN):

```bash
SEED_DEMO=false DATABASE_URL='postgresql://…@postgres:5432/survey?schema=public' \
  DIRECT_URL='postgresql://…@postgres:5432/survey?schema=public' \
  pnpm --filter @workspace/database db:seed
```

Local dev still uses `pnpm db:seed` / `prisma db seed` as usual.

## Optional compose image vars (ECR)

| Variable                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `ECR_REGISTRY`          | e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com` |
| `ECR_REPOSITORY_PREFIX` | e.g. `api-survey-prod`                               |
| `IMAGE_TAG`             | Release tag / `latest`                               |
| `APP_IMAGE_API`         | Override api/migrate image ref                       |
| `APP_IMAGE_WORKER`      | Override worker image ref                            |
| `APP_IMAGE_WEB`         | Override web image ref                               |

ECR is optional — first launch can build from Dockerfiles in compose.

## Optional app vars

| Variable           | Notes                                     |
| ------------------ | ----------------------------------------- |
| `MINIO_PUBLIC_URL` | Only if you front MinIO with a public URL |
| `LOG_LEVEL`        | `info` in production                      |
| `SWAGGER_ENABLED`  | `false`                                   |

## ETL (Convex sync)

Required on **api** and **worker** when using Master Data → Sync from Convex or `/admin/etl`. Self-hosted Convex must set `ETL_SECRET` to the same value as `ETL_CONVEX_SECRET`.

| Variable             | Where        | Notes                                                              |
| -------------------- | ------------ | ------------------------------------------------------------------ |
| `CONVEX_SITE_URL`    | api + worker | HTTP site URL (e.g. `https://….convex.site` or self-host site URL) |
| `ETL_CONVEX_SECRET`  | api + worker | Shared secret → `X-ETL-Secret` (must equal Convex `ETL_SECRET`)    |
| `ETL_ENABLED`        | api          | `true` to register incremental cron                                |
| `ETL_CRON`           | api          | Default `*/15 * * * *`                                             |
| `ETL_BATCH_SIZE`     | api          | Default `100`                                                      |
| `ETL_SYSTEM_USER_ID` | worker       | Optional Nest user UUID as survey creator fallback                 |
| `ETL_MAX_RETRIES`    | worker       | Default `5`                                                        |

Also ensure: worker replicas ≥ 1, MinIO bucket writable, geo catalog (ULBs/wards) seeded before first sync.

## Local development (unchanged)

Keep using root `docker-compose.yml` for Postgres/Redis/MinIO/Mailpit and `pnpm dev` for apps. Local Redis stays passwordless (`REDIS_URL=redis://localhost:6379`). Set `STORAGE_PROVIDER=minio` locally.

## Observability

See [`observability.md`](./observability.md) for `/metrics`, optional Prometheus/Grafana/Loki overlay, and volume backup notes.
