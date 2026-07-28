# Production Dokploy runbook

## Ownership

| Layer                          | Owner                         |
| ------------------------------ | ----------------------------- |
| Postgres, MinIO, Redis volumes | Dokploy host (Docker volumes) |
| web / api / worker / migrate   | Dokploy compose               |

OpenSearch is **not** deployed (application uses Prisma indexes only).

## Stack

Use root [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml):

- `postgres` — survey database
- `minio` + `minio-init` — object storage bucket
- `redis` — BullMQ
- `migrate` → `api` / `worker` / `web`

Primary guide: [`DEPLOYMENT.md`](../../DEPLOYMENT.md). Ops checklist: [production-deployment.md](./production-deployment.md).

**Important:** Never deploy the monorepo root as a runnable Dokploy/Nixpacks service. Prefer `docker-compose.dokploy.yml` + Dockerfiles under `apps/*/`. Alternative: three Applications with `NIXPACKS_CONFIG_FILE=apps/<api|web|worker>/nixpacks.toml`. Root has no application `start` script; root `nixpacks.toml` fails fast.

Env matrix: [dokploy-env.md](./dokploy-env.md)

Go-live: [go-live.md](./go-live.md)

## CI/CD (optional ECR)

Tag `v*` or workflow_dispatch → [`.github/workflows/release.yml`](../../.github/workflows/release.yml):

1. OIDC assume role (if configured)
2. Build/push api, web, worker to ECR
3. Dokploy webhook

First launch can skip ECR and build images on the Dokploy host.

## Rollback

1. Redeploy previous image tag / previous git revision via Dokploy.
2. Database: Prisma migrations are forward-only — keep migrations backward compatible; for catastrophic failure restore a Postgres volume backup ([backup-restore.md](./backup-restore.md)).
