# Deployment Guide

Turborepo + pnpm monorepo for **API Survey Apps**. Production deploys with **Docker only** — one Dokploy Compose stack (`docker-compose.dokploy.yml`). The repository root manages the workspace; it does not start application processes.

## Recommended architecture

**Dokploy Compose** (`docker-compose.dokploy.yml`): one stack with Postgres, Redis, MinIO, migrate, api, worker, and web. Correct networking, healthchecks, and migrations out of the box.

| Why Compose                       | Why not a single root process                              |
| --------------------------------- | ---------------------------------------------------------- |
| Infra + migrate + 3 apps together | One container cannot correctly expose web+api+worker + DB  |
| `turbo prune` slim images         | Root has no app `start` — leaves Swarm `0/1` / Traefik 502 |
| Traefik labels included           | Multi-process-in-one-image is fragile and hard to scale    |

Node **24+**, pnpm **11.17.0**, turbo **2.10.5**.

---

## Project structure

| Path                         | Role                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `apps/web`                   | Next.js 16 admin UI (port **3000**, health `/healthz`)    |
| `apps/api`                   | NestJS HTTP API (port **4000**, health `/live`)           |
| `apps/worker`                | BullMQ / PDF / ETL worker (port **4001**, health `/live`) |
| `packages/*`                 | Shared libraries                                          |
| `docker-compose.yml`         | Local infra only                                          |
| `docker-compose.dokploy.yml` | Production Compose stack for Dokploy                      |
| `apps/*/Dockerfile`          | Multi-stage images (`turbo prune --docker`)               |
| `.env.example`               | Local / Compose reference template                        |
| `deploy/env/*.env.example`   | Per-service production templates                          |

### Workspace scripts (apps)

| Script  | web                                         | api                  | worker               |
| ------- | ------------------------------------------- | -------------------- | -------------------- |
| `build` | `next build`                                | `nest build`         | `nest build`         |
| `start` | `next start --hostname 0.0.0.0 --port 3000` | `node dist/main.js`  | `node dist/main.js`  |
| `dev`   | `next dev …`                                | `nest start --watch` | `nest start --watch` |

Root helpers: `pnpm start:web` / `start:api` / `start:worker`. **No** root `start` that runs all apps.

**Web runtime note:** Docker uses Next.js **standalone** (`node apps/web/server.js`). Local `pnpm --filter web start` uses `next start`.

---

## Local development

```bash
pnpm install
cp .env.example .env.development
docker compose up -d
pnpm db:migrate
pnpm dev
```

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter=web... --filter=api... --filter=worker...
```

---

## Dokploy — Compose (only supported path)

> **Stop:** `open Dockerfile: no such file or directory` means the Dokploy app type is **Docker**, not **Compose**.  
> There is **intentionally no root `Dockerfile`**. Fix the Dokploy UI — do not add a root image.  
> Exact steps: [`docs/ops/dokploy-compose-setup.md`](docs/ops/dokploy-compose-setup.md).

There is **intentionally no root `Dockerfile`**. Do not create a single multi-process image for web+api+worker. Production is **Docker Compose only**.

| Setting       | Value                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Build type    | **Docker Compose** (not Dockerfile / Nixpacks / Railpack)                                             |
| Compose file  | `docker-compose.dokploy.yml`                                                                          |
| Build context | repository root (`.`)                                                                                 |
| Dockerfiles   | Per service only: `apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`              |
| Ports         | Traefik-only: web `3000`, api `4000`; worker `4001` remains internal                                  |
| Health        | web `/healthz`, api/worker `/live`                                                                    |
| Metrics       | api/worker `/metrics` (optional scrape; see [`docs/ops/observability.md`](docs/ops/observability.md)) |
| Infra images  | Postgres **17**, Redis **8**, MinIO (pinned RELEASE)                                                  |

1. Create a **Compose** application in Dokploy (build type = Docker Compose). See [`docs/ops/dokploy-compose-setup.md`](docs/ops/dokploy-compose-setup.md).
2. Compose file: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).
3. Build context = **repository root** (each service `build.context: .`).
4. Dockerfile paths (via compose): `apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`.
5. Secrets in Dokploy **Environment** UI — paste [`deploy/env/dokploy.compose.env.example`](deploy/env/dokploy.compose.env.example) (replace `REPLACE_ME_*`). Dokploy writes `.env`; compose loads it into migrate/api/worker/web.
   **Interpolation-required (no defaults):** `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `DATABASE_URL`.
   Do **not** set a static `REDIS_URL` — compose builds `redis://:${REDIS_PASSWORD}@redis:6379` for api/worker.
   Also set Clerk keys and `NEXT_PUBLIC_*` — see [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md).
6. Domains: `admin.sdvedutech.in` → web:**3000**; `backend.sdvedutech.in` → api:**4000** (Traefik container ports).
7. Traefik is the only ingress. Compose publishes no application ports on the host; worker `4001` stays internal.
8. Health: web `/healthz`, api/worker `/live`.
9. Deploy: migrate (`prisma migrate deploy` only) → api / worker / web healthy.
10. **First empty DB:** run one-time catalog seed (`SEED_DEMO=false pnpm --filter @workspace/database db:seed`) from a host that can reach Postgres — see [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md).

Web **build args** (Compose already wires these from the same Dokploy env): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

**Postgres 16 → 17:** existing data volumes are not binary-compatible. Dump/restore or recreate the volume before first PG17 start.

---

## Docker (manual)

```bash
docker build -f apps/api/Dockerfile -t api-survey-api:prod .
docker build -f apps/worker/Dockerfile -t api-survey-worker:prod .
docker build -f apps/web/Dockerfile -t api-survey-web:prod \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... .
docker compose -f docker-compose.dokploy.yml config
```

- Node **24**, pnpm **11.17.0** (via Corepack in build stages), `HUSKY=0`
- Web standalone; api/worker use `pnpm deploy --prod` runners + `node …/dist/main.js` as non-root
- `prisma` is a dependency of `@workspace/database`
- Optional observability overlay: [`docker-compose.observability.yml`](docker-compose.observability.yml)

---

## Required environment variables

Paste-ready Compose env: [`deploy/env/dokploy.compose.env.example`](deploy/env/dokploy.compose.env.example).  
Matrix: [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md). Local: [`.env.example`](.env.example).

---

## Troubleshooting

| Symptom                                                             | Fix                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open Dockerfile: no such file or directory`                        | Dokploy app type is **Docker**, not Compose. Recreate as **Docker Compose** with `docker-compose.dokploy.yml`. See [`docs/ops/dokploy-compose-setup.md`](docs/ops/dokploy-compose-setup.md). **Do not add a root Dockerfile.** |
| `MINIO_ROOT_USER` / `POSTGRES_PASSWORD` / `REDIS_PASSWORD` missing  | Paste [`deploy/env/dokploy.compose.env.example`](deploy/env/dokploy.compose.env.example) into Dokploy Environment                                                                                                              |
| Traefik 502 / no healthy process                                    | Use Compose + per-app Dockerfiles; no root Dockerfile / no monorepo-root start                                                                                                                                                 |
| App missing `DATABASE_URL` / Clerk                                  | Ensure vars are in Dokploy Environment UI; compose must `env_file: .env`                                                                                                                                                       |
| Migrate fails on `localhost`                                        | Use `@postgres` in `DATABASE_URL` / `DIRECT_URL` (Compose DNS), not localhost                                                                                                                                                  |
| Migrate exits 1 after migrate deploy on seed / `@prisma/adapter-pg` | Rebuild with current image — migrate no longer runs seed. Catalog seed is one-time manual (`pnpm db:seed`)                                                                                                                     |
| Redis AUTH / WRONGPASS on api/worker                                | Remove static `REDIS_URL` from Dokploy Environment; keep `REDIS_PASSWORD` only (must match Redis requirepass; URL-safe)                                                                                                        |
| Prisma generate fails                                               | Ensure dummy/real `DATABASE_URL` at build                                                                                                                                                                                      |
| Web missing Clerk/API URL                                           | Set `NEXT_PUBLIC_*` at **build** time                                                                                                                                                                                          |
| Worker Chromium fails                                               | Use `apps/worker/Dockerfile` (Debian + Playwright deps)                                                                                                                                                                        |
| Wrong workspace packages                                            | Build context = monorepo root                                                                                                                                                                                                  |
| Engine/lockfile errors                                              | Node >=24, pnpm 11.17.0 via corepack                                                                                                                                                                                           |

---

## Verification checklist

- [x] Nixpacks removed; Docker is the only deploy path
- [x] Compose `env_file: .env` (Dokploy) + optional `.env.production`
- [x] `prisma` in database dependencies
- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm turbo build --filter=web... --filter=api... --filter=worker...`
- [x] `docker compose -f docker-compose.dokploy.yml config`
- [x] Docker builds for web / api / worker
- [ ] Dokploy Compose live deploy

---

## Related docs

- [`docs/ops/dokploy-compose-setup.md`](docs/ops/dokploy-compose-setup.md)
- [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md)
- [`docs/ops/dokploy-runbook.md`](docs/ops/dokploy-runbook.md)
- [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md)
- [`docs/ops/observability.md`](docs/ops/observability.md)
- [`docs/ops/go-live.md`](docs/ops/go-live.md)
- [`docs/superpowers/specs/2026-07-28-docker-dokploy-nixpacks-removal-design.md`](docs/superpowers/specs/2026-07-28-docker-dokploy-nixpacks-removal-design.md)
