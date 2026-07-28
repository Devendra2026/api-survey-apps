# Production Dokploy runbook

## Ownership

| Layer                          | Owner                         |
| ------------------------------ | ----------------------------- |
| Postgres, MinIO, Redis volumes | Dokploy host (Docker volumes) |
| web / api / worker / migrate   | Dokploy compose               |

OpenSearch is **not** deployed (application uses Prisma indexes only).

## Stack

**Operator setup (exact UI steps):** [`dokploy-compose-setup.md`](./dokploy-compose-setup.md)

Use root [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml) as a **single Compose application**:

- Build type: **Docker Compose** (not a root Dockerfile / Nixpacks)
- Compose file: `docker-compose.dokploy.yml`
- Build context: repository root
- Per-service Dockerfiles: `apps/{web,api,worker}/Dockerfile` (`turbo prune --docker`)
- Services: `postgres`, `redis`, `minio`, `minio-init`, `migrate`, `api`, `worker`, `web`
- Startup: `minio-init` waits for MinIO **healthy** (no `connection refused` spam); `migrate` is a one-shot with healthcheck disabled (`No pending migrations to apply.` is success; also runs **catalog seed** unless `SKIP_DB_SEED=true`)
- Domains (Traefik labels): `admin.sdvedutech.in` → web:**3000**; `backend.sdvedutech.in` → api:**4000**

If Dokploy errors with `open Dockerfile: no such file or directory`, the app is the wrong type — see [dokploy-compose-setup.md](./dokploy-compose-setup.md) § “If you see this error”.

Primary guide: [`DEPLOYMENT.md`](../../DEPLOYMENT.md). Ops checklist: [production-deployment.md](./production-deployment.md).

**Important:** There is intentionally **no root Dockerfile**. Inject secrets via Dokploy Environment UI (Dokploy writes `.env`; compose loads it). Optional on-disk `.env.production` for local compose only. See [`DEPLOYMENT.md`](../../DEPLOYMENT.md).

Env matrix: [dokploy-env.md](./dokploy-env.md)

Go-live: [go-live.md](./go-live.md)

## CI/CD (optional ECR)

Tag `v*` or workflow_dispatch → [`.github/workflows/release.yml`](../../.github/workflows/release.yml):

1. OIDC assume role (if configured)
2. Build/push api, web, worker to ECR (per-app Dockerfiles, context = repo root)
3. Dokploy webhook

First launch can skip ECR and build images on the Dokploy host from compose.

## Rollback

1. Redeploy previous image tag / previous git revision via Dokploy.
2. Database: Prisma migrations are forward-only — keep migrations backward compatible; for catastrophic failure restore a Postgres volume backup ([backup-restore.md](./backup-restore.md)).
