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
| `DEMAND_NOTICE_PRINT_SECRET`                                | api                                                 |
| `STORAGE_PROVIDER=minio`, `MINIO_BUCKET` / `STORAGE_BUCKET` | api/worker (endpoint overridden by compose)         |

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

CORS_ORIGIN=https://admin.sdvedutech.in
APP_URL=https://admin.sdvedutech.in
DEMAND_NOTICE_PRINT_SECRET=REPLACE_ME_LONG_RANDOM

STORAGE_PROVIDER=minio
MINIO_BUCKET=api-survey-app
STORAGE_BUCKET=api-survey-app
NODE_ENV=production
```

Use a URL-safe `REDIS_PASSWORD` (avoid `@`, `:`, `/`).

## Required (full table)

| Variable                            | Example / source                                                |
| ----------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                          | `production`                                                    |
| `POSTGRES_USER`                     | `postgres` (optional; default)                                  |
| `POSTGRES_PASSWORD`                 | Strong password (must match URLs below) — **required**          |
| `POSTGRES_DB`                       | `survey` (optional; default)                                    |
| `DATABASE_URL`                      | `postgresql://postgres:PASS@postgres:5432/survey?schema=public` |
| `DIRECT_URL`                        | Same as `DATABASE_URL` for migrate                              |
| `REDIS_PASSWORD`                    | Strong URL-safe password — **required**                         |
| `REDIS_URL`                         | Compose sets `redis://:${REDIS_PASSWORD}@redis:6379`            |
| `STORAGE_PROVIDER`                  | `minio`                                                         |
| `MINIO_ROOT_USER`                   | Strong unique user — **required**                               |
| `MINIO_ROOT_PASSWORD`               | Strong password — **required**                                  |
| `MINIO_ENDPOINT`                    | `http://minio:9000` (compose overrides for api/worker)          |
| `MINIO_BUCKET`                      | `api-survey-app`                                                |
| `STORAGE_BUCKET`                    | Same as `MINIO_BUCKET`                                          |
| `CORS_ORIGIN`                       | `https://admin.sdvedutech.in`                                   |
| `APP_URL`                           | `https://admin.sdvedutech.in`                                   |
| `NEXT_PUBLIC_API_URL`               | `https://backend.sdvedutech.in` (**build arg** for web)         |
| `CLERK_SECRET_KEY`                  | Clerk dashboard                                                 |
| `CLERK_PUBLISHABLE_KEY`             | Clerk dashboard                                                 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard (**build arg** for web)                         |
| `CLERK_AUTHORIZED_PARTIES`          | `https://admin.sdvedutech.in`                                   |
| `DEMAND_NOTICE_PRINT_SECRET`        | Strong random secret                                            |

## Optional (recommended)

| Variable                          | Notes                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Web build arg; maps UI                                                               |
| `WEB_HOST` / `API_HOST`           | Override Traefik Host rules                                                          |
| `BOOTSTRAP_ADMIN_CLERK_USER_IDS`  | Clerk `user_…` ids (comma-separated). Promotes first admin (incl. from Pending User) |
| `SKIP_DB_SEED`                    | `true` to skip catalog seed on migrate (default runs seed)                           |
| `SEED_DEMO`                       | `true` seeds demo users/surveys — keep `false` in production                         |

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
