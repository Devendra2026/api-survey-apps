# API Survey Apps

Turborepo monorepo: Next.js web, NestJS API, BullMQ worker, shared packages — production-ready for **Dokploy**, **Docker Swarm**, and **Traefik**.

## Stack

| Path          | Role                                        |
| ------------- | ------------------------------------------- |
| `apps/web`    | Next.js 16 admin UI (port **3000**)         |
| `apps/api`    | NestJS HTTP API (port **4000**)             |
| `apps/worker` | BullMQ / PDF / ETL consumer (port **4001**) |
| `packages/*`  | Shared libraries (not deployed alone)       |

The **repository root** only manages the workspace (`pnpm install`, `pnpm build`, DB scripts). It does **not** start application processes.

## Prerequisites

- Node.js 22.12+
- pnpm 10.33.4 (`corepack enable`)
- Docker (for Postgres / Redis / MinIO and production images)

## Quick start (local)

```bash
pnpm install
cp .env.example .env.development
docker compose up -d                           # Postgres, Redis, MinIO, Mailpit
pnpm db:migrate
pnpm dev                                       # api + web + worker
```

- Web: http://localhost:3000
- API live: http://localhost:4000/live
- Worker live: http://localhost:4001/live

## Production deployment (Dokploy)

**Full guide:** [`DEPLOYMENT.md`](DEPLOYMENT.md) — start with **Dokploy in 60 seconds**.

**Do not** deploy the monorepo root as a single Nixpacks app. That caused Swarm `0/1` replicas and Traefik **502**. Root `nixpacks.toml` fails fast; use Compose or `NIXPACKS_CONFIG_FILE=apps/<app>/nixpacks.toml`.

### Path 1: one Compose application

1. Dokploy → new Compose application
2. File: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml)
3. Env: paste into Dokploy **Environment** UI (see [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md) and [`deploy/env/*.env.example`](deploy/env/)). No on-disk `.env.production` required.
4. Domains (Traefik labels included):
   - `admin.sdvedutech.in` → **web:3000**
   - `backend.sdvedutech.in` → **api:4000**
5. Builder must use each service’s **Dockerfile** (compose `build.dockerfile` paths; images use `turbo prune`)

### Path 2: three Nixpacks applications

Build context = repo root; set `NIXPACKS_CONFIG_FILE=apps/web|api|worker/nixpacks.toml` per app. Run migrations separately (`pnpm --filter @workspace/database db:deploy`).

Ops detail: [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md)

### Per-service Dockerfiles

```bash
docker build -f apps/api/Dockerfile -t api-survey-api:prod .
docker build -f apps/worker/Dockerfile -t api-survey-worker:prod .
docker build -f apps/web/Dockerfile -t api-survey-web:prod \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... .
```

| Service | Start inside image                     | Health     |
| ------- | -------------------------------------- | ---------- |
| api     | `pnpm --filter api start`              | `/live`    |
| worker  | `pnpm --filter worker start`           | `/live`    |
| web     | `node apps/web/server.js` (standalone) | `/healthz` |

All listen on `0.0.0.0`.

### Docker Swarm + Traefik

```bash
docker network create --driver=overlay --attachable traefik-public
docker stack deploy -c deploy/docker-stack.swarm.yml survey
```

See [`deploy/docker-stack.swarm.yml`](deploy/docker-stack.swarm.yml).

## Scripts

| Command                      | Description                    |
| ---------------------------- | ------------------------------ |
| `pnpm dev`                   | Watch mode: web + api + worker |
| `pnpm build`                 | Turbo build all packages/apps  |
| `pnpm --filter api start`    | Production API                 |
| `pnpm --filter web start`    | Production Next.js             |
| `pnpm --filter worker start` | Production worker              |
| `pnpm db:deploy`             | Prisma migrate deploy          |

## Environment

- [`.env.example`](.env.example) — copy to `.env.development` for local work
- `deploy/env/api.env.example`
- `deploy/env/web.env.example`
- `deploy/env/worker.env.example`

## Ops docs

- [**DEPLOYMENT.md**](DEPLOYMENT.md) — structure, local, Dokploy, Nixpacks, Docker, env, troubleshooting
- [Production / Dokploy / Traefik](docs/ops/production-deployment.md)
- [Dokploy runbook](docs/ops/dokploy-runbook.md)
- [Env matrix](docs/ops/dokploy-env.md)
- [Go-live](docs/ops/go-live.md)
