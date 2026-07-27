# Dokploy environment variables (production)

Data plane runs **inside** the compose stack (Postgres, MinIO, Redis). Prefer Dokploy secrets for passwords — do not commit real values.

## Required

| Variable                            | Example / source                                                |
| ----------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                          | `production`                                                    |
| `POSTGRES_USER`                     | `postgres`                                                      |
| `POSTGRES_PASSWORD`                 | Strong password (must match URLs below)                         |
| `POSTGRES_DB`                       | `survey`                                                        |
| `DATABASE_URL`                      | `postgresql://postgres:PASS@postgres:5432/survey?schema=public` |
| `DIRECT_URL`                        | Same as `DATABASE_URL` for migrate                              |
| `REDIS_URL`                         | `redis://redis:6379`                                            |
| `STORAGE_PROVIDER`                  | `minio`                                                         |
| `MINIO_ROOT_USER`                   | `minioadmin` (or custom)                                        |
| `MINIO_ROOT_PASSWORD`               | Strong password                                                 |
| `MINIO_ENDPOINT`                    | `http://minio:9000` (compose overrides this for api/worker)     |
| `MINIO_BUCKET`                      | `api-survey-app`                                                |
| `STORAGE_BUCKET`                    | Same as `MINIO_BUCKET`                                          |
| `CORS_ORIGIN`                       | `https://admin.sdvedutech.in`                                   |
| `APP_URL`                           | `https://admin.sdvedutech.in`                                   |
| `NEXT_PUBLIC_API_URL`               | `https://backend.sdvedutech.in`                                 |
| `CLERK_SECRET_KEY`                  | Clerk dashboard                                                 |
| `CLERK_PUBLISHABLE_KEY`             | Clerk dashboard                                                 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard                                                 |
| `CLERK_AUTHORIZED_PARTIES`          | `https://admin.sdvedutech.in`                                   |
| `DEMAND_NOTICE_PRINT_SECRET`        | Strong random secret                                            |

## Optional compose image vars (ECR)

| Variable                | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `ECR_REGISTRY`          | e.g. `123456789012.dkr.ecr.ap-south-1.amazonaws.com` |
| `ECR_REPOSITORY_PREFIX` | e.g. `api-survey-prod`                               |
| `IMAGE_TAG`             | Release tag / `latest`                               |

ECR is optional — first launch can build from Dockerfiles in compose.

## Optional app vars

| Variable                    | Notes                                     |
| --------------------------- | ----------------------------------------- |
| `MINIO_PUBLIC_URL`          | Only if you front MinIO with a public URL |
| `LOG_LEVEL`                 | `info` in production                      |
| `SWAGGER_ENABLED`           | `false`                                   |
| `ETL_*` / `CONVEX_SITE_URL` | Only if Convex ETL remains enabled        |

## Local development (unchanged)

Keep using root `docker-compose.yml` for Postgres/Redis/MinIO/Mailpit and `pnpm dev` for apps. Set `STORAGE_PROVIDER=minio` locally.
