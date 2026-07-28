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

1. Create a **Compose** application in Dokploy.
2. Compose file: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).
3. Build context = **repository root** (each service `build.context: .`).
4. Dockerfile paths (via compose): `apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/worker/Dockerfile`.
5. Secrets in Dokploy **Environment** UI (`.env.production` optional via `env_file.required: false`).
6. Domains: `admin.sdvedutech.in` → web:3000; `backend.sdvedutech.in` → api:4000.
7. Host ports: web `3001→3000`, api `4000`, worker `4001`.
8. Health: web `/healthz`, api/worker `/live`.
9. Deploy: migrate → api / worker / web healthy.

Web **build args** (Compose already wires these): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

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
- Web standalone; api/worker run `node …/dist/main.js` as non-root
- `prisma` is a dependency of `@workspace/database`

---

## Required environment variables

See [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md), [`.env.example`](.env.example), [`deploy/env/`](deploy/env/).

---

## Troubleshooting

| Symptom                          | Fix                                                                       |
| -------------------------------- | ------------------------------------------------------------------------- |
| Traefik 502 / no healthy process | Use Compose + Dockerfiles; do not start the monorepo root as a single app |
| Prisma generate fails            | Ensure dummy/real `DATABASE_URL` at build                                 |
| Web missing Clerk/API URL        | Set `NEXT_PUBLIC_*` at **build** time                                     |
| Worker Chromium fails            | Use `apps/worker/Dockerfile` (Debian + Playwright deps)                   |
| Wrong workspace packages         | Build context = monorepo root                                             |
| Engine/lockfile errors           | Node >=24, pnpm 11.17.0 via corepack                                      |

---

## Verification checklist

- [x] Nixpacks removed; Docker is the only deploy path
- [x] Compose `env_file` optional
- [x] `prisma` in database dependencies
- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm turbo build --filter=web... --filter=api... --filter=worker...`
- [x] `docker compose -f docker-compose.dokploy.yml config`
- [x] Docker builds for web / api / worker
- [ ] Dokploy Compose live deploy

---

## Related docs

- [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md)
- [`docs/ops/dokploy-runbook.md`](docs/ops/dokploy-runbook.md)
- [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md)
- [`docs/ops/go-live.md`](docs/ops/go-live.md)
- [`docs/superpowers/specs/2026-07-28-docker-dokploy-nixpacks-removal-design.md`](docs/superpowers/specs/2026-07-28-docker-dokploy-nixpacks-removal-design.md)
