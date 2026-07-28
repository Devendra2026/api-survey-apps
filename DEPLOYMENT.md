# Deployment Guide

Turborepo + pnpm monorepo for **API Survey Apps**. The repository root manages the workspace only — it is **not** a deployable application process.

## Project structure

| Path                         | Role                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/web`                   | Next.js 16 admin UI (port **3000**, health `/healthz`)                                               |
| `apps/api`                   | NestJS HTTP API (port **4000**, health `/live`)                                                      |
| `apps/worker`                | BullMQ / PDF / ETL worker (port **4001**, health `/live`)                                            |
| `packages/*`                 | Shared libraries (`@workspace/database`, `validation`, `etl-core`, `excel-reports`, `jobs`, `ui`, …) |
| `docker-compose.yml`         | Local infra only (Postgres, Redis, MinIO, Mailpit)                                                   |
| `docker-compose.dokploy.yml` | Production Compose stack for Dokploy                                                                 |
| `apps/*/Dockerfile`          | Multi-stage production images (`turbo prune --docker`)                                               |
| `apps/*/nixpacks.toml`       | Per-app Nixpacks configs                                                                             |
| `nixpacks.toml` (root)       | **Fail-fast** — do not deploy root with Nixpacks                                                     |

### Workspace scripts (apps)

Every deployable app has:

| Script  | web                                         | api                  | worker               |
| ------- | ------------------------------------------- | -------------------- | -------------------- |
| `build` | `next build`                                | `nest build`         | `nest build`         |
| `start` | `next start --hostname 0.0.0.0 --port 3000` | `node dist/main.js`  | `node dist/main.js`  |
| `dev`   | `next dev …`                                | `nest start --watch` | `nest start --watch` |

Root: `pnpm build` → `turbo build`, `pnpm dev` → filtered turbo. **No** root `start`.

---

## Local development

```bash
# Prerequisites: Node.js 22.12+, pnpm 10.33.4 (corepack enable), Docker
pnpm install
docker compose up -d          # Postgres, Redis, MinIO, Mailpit
pnpm db:migrate
pnpm dev                      # api + web + worker
```

- Web: http://localhost:3000
- API: http://localhost:4000/live
- Worker: http://localhost:4001/live

Verify a fresh clone:

```bash
pnpm install
pnpm turbo build
# or filtered:
pnpm turbo build --filter=web...
pnpm turbo build --filter=api...
pnpm turbo build --filter=worker...
```

---

## Production deployment (overview)

Two equally supported paths:

1. **Dokploy Compose** — `docker-compose.dokploy.yml` + Dockerfiles (recommended for a full stack with Postgres/Redis/MinIO).
2. **Three Nixpacks apps** — each with `NIXPACKS_CONFIG_FILE=apps/<app>/nixpacks.toml`.

**Never** point Dokploy Nixpacks at the monorepo root without `NIXPACKS_CONFIG_FILE`. Root [`nixpacks.toml`](nixpacks.toml) exits on purpose to prevent Swarm `0/1` replicas and Traefik **502**.

Detailed ops: [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md), [`docs/ops/dokploy-runbook.md`](docs/ops/dokploy-runbook.md).

---

## Dokploy — Compose (path 1)

1. Create a **Compose** application in Dokploy.
2. Compose file: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).
3. Inject secrets (see [Required environment variables](#required-environment-variables) and [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md)).
4. Domains (Traefik labels included):
   - `admin.sdvedutech.in` → **web:3000**
   - `backend.sdvedutech.in` → **api:4000**
5. Deploy. Order: `migrate` completes → `api` / `worker` / `web` become healthy.

### Stack services

| Service            | Image / build            | Notes                            |
| ------------------ | ------------------------ | -------------------------------- |
| postgres           | `postgres:16-alpine`     | Volume `survey_pg_data_prod`     |
| redis              | `redis:7-alpine`         | BullMQ                           |
| minio + minio-init | MinIO                    | Object storage bucket            |
| migrate            | `apps/api/Dockerfile`    | One-shot `prisma migrate deploy` |
| api                | `apps/api/Dockerfile`    | Port 4000                        |
| worker             | `apps/worker/Dockerfile` | Port 4001 (internal)             |
| web                | `apps/web/Dockerfile`    | Port 3000 (host map 3001:3000)   |

Build context for all app images is the **repository root**. Dockerfiles use `turbo prune <app> --docker` for a minimal install graph.

---

## Dokploy — Nixpacks (path 2)

Create **three** Applications. For each:

| Setting       | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Build context | Repository root                                              |
| Builder       | Nixpacks                                                     |
| Config        | `NIXPACKS_CONFIG_FILE=apps/<web\|api\|worker>/nixpacks.toml` |
| Do not set    | Root Start Command / bare `pnpm start`                       |

| App    | Config file                 | Start (from config)          | Port |
| ------ | --------------------------- | ---------------------------- | ---- |
| web    | `apps/web/nixpacks.toml`    | `pnpm --filter web start`    | 3000 |
| api    | `apps/api/nixpacks.toml`    | `pnpm --filter api start`    | 4000 |
| worker | `apps/worker/nixpacks.toml` | `pnpm --filter worker start` | 4001 |

### What each Nixpacks build runs

- **Install:** `pnpm install --frozen-lockfile` (Node 22, pnpm from `packageManager`)
- **web build:** `pnpm turbo build --filter=web...`
- **api build:** `pnpm --filter @workspace/database db:generate` then `pnpm turbo build --filter=api...`
- **worker build:** generate + `pnpm turbo build --filter=worker...` + Playwright Chromium

For **web**, set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and optional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` as Dokploy **build-time** env vars (they are inlined into the client bundle).

Provide Postgres, Redis, and object storage separately when not using Compose (or point env at managed services). Run migrations before/with API:

```bash
pnpm --filter @workspace/database db:deploy
# or via api image:
# docker run --rm --env-file api.env --entrypoint sh api-survey-api:prod \
#   /app/apps/api/docker-entrypoint.migrate.sh
```

---

## Docker deployment (manual)

```bash
docker build -f apps/api/Dockerfile -t api-survey-api:prod .
docker build -f apps/worker/Dockerfile -t api-survey-worker:prod .
docker build -f apps/web/Dockerfile -t api-survey-web:prod \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=... .

docker compose -f docker-compose.dokploy.yml config   # validate
docker compose -f docker-compose.dokploy.yml up -d    # if running Compose locally
```

### Docker Swarm + Traefik

```bash
docker network create --driver=overlay --attachable traefik-public
docker stack deploy -c deploy/docker-stack.swarm.yml survey
```

See [`deploy/docker-stack.swarm.yml`](deploy/docker-stack.swarm.yml).

### Image design

- Multi-stage: `prepare` (turbo prune) → `deps` (pnpm install) → `builder` → slim `runner`
- Node **22**, pnpm **10.33.4** via corepack
- Web: Next.js `output: "standalone"`
- api/worker: production `dist` + workspace packages; non-root users; `HEALTHCHECK`
- Worker: Debian slim + Playwright Chromium deps

---

## Required environment variables

Full matrix: [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md). Templates: [`deploy/env/`](deploy/env/).

### Always required (production)

| Variable                                                      | Notes                                   |
| ------------------------------------------------------------- | --------------------------------------- |
| `NODE_ENV`                                                    | `production`                            |
| `DATABASE_URL` / `DIRECT_URL`                                 | Postgres (migrate prefers `DIRECT_URL`) |
| `REDIS_URL`                                                   | e.g. `redis://redis:6379`               |
| `STORAGE_PROVIDER`                                            | `minio` (or AWS if configured)          |
| `MINIO_*` / `STORAGE_BUCKET`                                  | When using MinIO                        |
| `CORS_ORIGIN` / `APP_URL`                                     | Public web origin                       |
| `NEXT_PUBLIC_API_URL`                                         | Public API URL (web build)              |
| `CLERK_SECRET_KEY`                                            | API                                     |
| `CLERK_PUBLISHABLE_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | API + web                               |
| `CLERK_AUTHORIZED_PARTIES`                                    | Web origin(s)                           |
| `DEMAND_NOTICE_PRINT_SECRET`                                  | Strong random secret                    |

### Compose infra

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, optional `WEB_HOST` / `API_HOST`.

### ETL (optional)

`CONVEX_SITE_URL`, `ETL_CONVEX_SECRET`, `ETL_ENABLED`, etc. — see dokploy-env.md.

---

## Troubleshooting

| Symptom                                                      | Cause                                     | Fix                                                                          |
| ------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Build fails: `Do not deploy the monorepo root with Nixpacks` | Dokploy using root Nixpacks               | Switch to Compose **or** set `NIXPACKS_CONFIG_FILE=apps/<app>/nixpacks.toml` |
| Traefik **502**, Swarm `0/1`                                 | Root / wrong start; no healthy process    | Deploy per-app images; check `/live` or `/healthz`                           |
| Prisma generate fails at build                               | Missing/invalid `DATABASE_URL`            | Dummy URL is set in Docker/Nixpacks; ensure config file is used              |
| Web missing Clerk/API URL in browser                         | `NEXT_PUBLIC_*` not set at **build** time | Rebuild web with build args / Nixpacks env                                   |
| Worker PDF/Chromium fails                                    | Playwright browsers missing               | Worker Dockerfile/Nixpacks installs Chromium; check image rebuild            |
| Workspace package not found                                  | Install not from repo root                | Always build with context = monorepo root                                    |
| `pnpm install` twice / lockfile drift                        | Mismatched pnpm                           | Use `packageManager` pnpm 10.33.4 via corepack                               |

---

## Verification checklist

- [x] Root has no app `start` (workspace tooling only)
- [x] Root Nixpacks fails fast without override (`nixpacks.toml` build/`start` exit 1)
- [x] `pnpm install` succeeds
- [x] `pnpm turbo build --filter=web... --filter=api... --filter=worker...` succeeds
- [x] Workspace packages resolve (`@workspace/*` via turbo graph)
- [x] `docker compose -f docker-compose.dokploy.yml config` validates
- [x] `turbo prune <app> --docker` produces `out/json` + `out/full` (incl. api entrypoints)
- [ ] `docker build -f apps/web/Dockerfile .` (requires Docker daemon)
- [ ] `docker build -f apps/api/Dockerfile .` (requires Docker daemon)
- [ ] `docker build -f apps/worker/Dockerfile .` (requires Docker daemon)
- [ ] Dokploy Compose deploys healthy migrate → api/worker/web
- [ ] Dokploy Nixpacks per app with `NIXPACKS_CONFIG_FILE` works

---

## Related docs

- [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md)
- [`docs/ops/dokploy-runbook.md`](docs/ops/dokploy-runbook.md)
- [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md)
- [`docs/ops/go-live.md`](docs/ops/go-live.md)
- [`docs/superpowers/specs/2026-07-28-dokploy-monorepo-deploy-design.md`](docs/superpowers/specs/2026-07-28-dokploy-monorepo-deploy-design.md)
