# Dokploy environment variables (production)

Data plane runs **inside** the compose stack (Postgres 17, MinIO, Redis 8). Prefer Dokploy secrets for passwords — do not commit real values.

## How Dokploy injects env

1. Paste variables into the Compose app **Environment** UI.
2. Dokploy writes them to a `.env` file beside the compose file (used for `${VAR}` interpolation **and** for container injection).
3. [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml) loads that file on `migrate` / `api` / `worker` / `web` via `env_file: .env` (`required: false`). An optional `.env.production` (or `DOKPLOY_ENV_FILE`) is a local/offline fallback only.

UI variables are **not** auto-injected unless referenced via `env_file` or `environment: ${VAR}` — that is why compose must load `.env`.

Compose **requires** (no insecure defaults): `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `DATABASE_URL` (and ideally `DIRECT_URL`).

`REDIS_URL` for api/worker is set by compose to `redis://:${REDIS_PASSWORD}@redis:6379`. Compose also injects `DATABASE_URL`, MinIO credentials, and `MINIO_ENDPOINT` into api/worker so containers receive them even if only Dokploy `.env` interpolation is used.

Use URL-safe Redis passwords (avoid `@`, `:`, `/` in the password) so the composed `REDIS_URL` remains valid.

## Required

| Variable                            | Example / source                                                |
| ----------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                          | `production`                                                    |
| `POSTGRES_USER`                     | `postgres` (optional; default)                                  |
| `POSTGRES_PASSWORD`                 | Strong password (must match URLs below) — **required**          |
| `POSTGRES_DB`                       | `survey` (optional; default)                                    |
| `DATABASE_URL`                      | `postgresql://postgres:PASS@postgres:5432/survey?schema=public` |
| `DIRECT_URL`                        | Same as `DATABASE_URL` for migrate (compose prefers this)       |
| `REDIS_PASSWORD`                    | Strong URL-safe password — **required**                         |
| `REDIS_URL`                         | Compose sets `redis://:${REDIS_PASSWORD}@redis:6379`            |
| `STORAGE_PROVIDER`                  | `minio`                                                         |
| `MINIO_ROOT_USER`                   | Strong unique user — **required**                               |
| `MINIO_ROOT_PASSWORD`               | Strong password — **required**                                  |
| `MINIO_ENDPOINT`                    | `http://minio:9000` (compose overrides this for api/worker)     |
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

| Variable                          | Notes                       |
| --------------------------------- | --------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Web build arg; maps UI      |
| `WEB_HOST` / `API_HOST`           | Override Traefik Host rules |
| `BOOTSTRAP_ADMIN_CLERK_USER_IDS`  | One-shot admin bootstrap    |

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

Also ensure: worker replicas ≥ 1, MinIO bucket writable, geo catalog (ULBs/wards) seeded before first sync. UI: Tenants & Wards **Sync from Convex** and Administration → **ETL Sync**.

## Local development (unchanged)

Keep using root `docker-compose.yml` for Postgres/Redis/MinIO/Mailpit and `pnpm dev` for apps. Local Redis stays passwordless (`REDIS_URL=redis://localhost:6379`). Set `STORAGE_PROVIDER=minio` locally.

## Observability

See [`observability.md`](./observability.md) for `/metrics`, optional Prometheus/Grafana/Loki overlay, and volume backup notes.
