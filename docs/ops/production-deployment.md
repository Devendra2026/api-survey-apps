# Production deployment — Dokploy + Railpack / Docker

## Inventory

| Path          | Type            | Role                                  | Port | Long-running |
| ------------- | --------------- | ------------------------------------- | ---- | ------------ |
| `apps/api`    | NestJS          | HTTP API + ETL cron registration      | 4000 | Yes          |
| `apps/web`    | Next.js 16      | Admin UI                              | 3000 | Yes          |
| `apps/worker` | NestJS + BullMQ | Background jobs / PDF / ETL consumers | 4001 | Yes          |
| `packages/*`  | Libraries       | Shared code (not deployed alone)      | —    | No           |

ETL cron is registered **inside the API** process (`ETL_ENABLED` / `ETL_CRON`). There is no separate cron container.

---

## Recommendation: how to deploy

**Preferred for Dokploy + Docker Swarm:** deploy the whole stack with
[`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml) as **one** Dokploy Compose application.

**Alternative:** three separate Dokploy Application services (api / web / worker), each building from its Dockerfile, plus managed or compose-backed Postgres/Redis/MinIO.

Do **not** deploy the monorepo root as a single Railpack app. Root `pnpm start` exits with code **1** on purpose.

---

## Railpack configuration

Railpack reads `railpack.json` in the build root.

| Service        | Config file                                                    | When building from repo root                          |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| API            | [`apps/api/railpack.json`](../../apps/api/railpack.json)       | Set env `RAILPACK_CONFIG_FILE=apps/api/railpack.json` |
| Web            | [`apps/web/railpack.json`](../../apps/web/railpack.json)       | `RAILPACK_CONFIG_FILE=apps/web/railpack.json`         |
| Worker         | [`apps/worker/railpack.json`](../../apps/worker/railpack.json) | `RAILPACK_CONFIG_FILE=apps/worker/railpack.json`      |
| Root (blocked) | [`railpack.json`](../../railpack.json)                         | Refuses to start                                      |

### Per-service Railpack / Dokploy settings

#### API

| Setting                     | Value                                                    |
| --------------------------- | -------------------------------------------------------- |
| Builder                     | Dockerfile **or** Railpack                               |
| Dockerfile                  | `apps/api/Dockerfile`                                    |
| Context / Working Directory | Repository root `/`                                      |
| Build Command               | `pnpm turbo build --filter=api...` (after `db:generate`) |
| Start Command               | `pnpm --filter api start` → `node dist/main.js`          |
| Port                        | `4000`                                                   |
| Health Check                | `GET /live` → `http://127.0.0.1:4000/live`               |
| Restart Policy              | `unless-stopped` / Swarm `on-failure`                    |

Railpack env overrides (if not using config file):

```text
RAILPACK_NODE_VERSION=22
RAILPACK_BUILD_CMD=pnpm --filter @workspace/database db:generate && pnpm turbo build --filter=api...
RAILPACK_START_CMD=pnpm --filter api start
```

#### Web

| Setting                     | Value                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Builder                     | Dockerfile **or** Railpack                                                                    |
| Dockerfile                  | `apps/web/Dockerfile`                                                                         |
| Context / Working Directory | Repository root `/`                                                                           |
| Build Command               | `pnpm turbo build --filter=web...`                                                            |
| Build args                  | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Start Command               | `pnpm --filter web start` → `next start`                                                      |
| Port                        | `3000` (publish host `3001:3000` if desired)                                                  |
| Health Check                | `GET /healthz` → `http://127.0.0.1:3000/healthz`                                              |
| Restart Policy              | `unless-stopped` / Swarm `on-failure`                                                         |

```text
RAILPACK_NODE_VERSION=22
RAILPACK_BUILD_CMD=pnpm turbo build --filter=web...
RAILPACK_START_CMD=pnpm --filter web start
```

#### Worker

| Setting                     | Value                                                         |
| --------------------------- | ------------------------------------------------------------- |
| Builder                     | Dockerfile **or** Railpack                                    |
| Dockerfile                  | `apps/worker/Dockerfile`                                      |
| Context / Working Directory | Repository root `/`                                           |
| Build Command               | `pnpm turbo build --filter=worker...` (+ Playwright Chromium) |
| Start Command               | `pnpm --filter worker start` → `node dist/main.js`            |
| Port                        | `4001`                                                        |
| Health Check                | `GET /live` → `http://127.0.0.1:4001/live`                    |
| Restart Policy              | `unless-stopped` / Swarm `on-failure`                         |

```text
RAILPACK_NODE_VERSION=22
RAILPACK_BUILD_CMD=pnpm --filter @workspace/database db:generate && pnpm turbo build --filter=worker... && pnpm --filter worker exec playwright install chromium
RAILPACK_START_CMD=pnpm --filter worker start
```

---

## Docker configuration

- Multi-stage builds with **pnpm 11.16.0** (matches `packageManager`)
- BuildKit cache mount for the pnpm store
- Non-root users (`nestjs` / `nextjs` / `worker`)
- `HEALTHCHECK` on api, web, worker images
- Runtime CMD keeps the process in the foreground (`node dist/main.js` / `node apps/web/server.js`)
- Migrate is a **one-shot** job (`restart: "no"`) — expected to exit 0 after `prisma migrate deploy`

```bash
# From repo root
docker build -f apps/api/Dockerfile -t api-survey-api:local .
docker build -f apps/web/Dockerfile -t api-survey-web:local .
docker build -f apps/worker/Dockerfile -t api-survey-worker:local .

# Containers must stay running (need real env for api/worker)
docker run --rm -p 3000:3000 api-survey-web:local
```

---

## Local production script validation

```bash
pnpm install
pnpm build

# Each app (requires env — see dokploy-env.md)
pnpm --filter api start
pnpm --filter web start
pnpm --filter worker start

# Must fail (exit 1) — never start production from root
pnpm start
```

---

## Exit-code / “container died immediately” checklist

| Risk                                                      | Status                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| Root `pnpm start` as production CMD                       | Fixed — exits **1** with message         |
| API `start` was `nest start` (needs CLI / wrong for prod) | Fixed — `node dist/main.js`              |
| Worker missing `start` script                             | Fixed — `node dist/main.js`              |
| MinIO healthcheck used `mc` inside `minio/minio`          | Fixed — `/minio/health/live`             |
| Web healthcheck hit `/` (auth/UI)                         | Fixed — `/healthz`                       |
| Web PORT 3001 inside container mismatch                   | Fixed — listen **3000**, map `3001:3000` |
| `process.exit(0)` on SIGTERM                              | Intentional graceful shutdown only       |
| `migrate` exits 0                                         | Intentional one-shot job                 |

---

## Production checklist (Dokploy)

1. [ ] Provision host with Docker Swarm / Dokploy
2. [ ] Create Compose application pointing at this repo + `docker-compose.dokploy.yml`
3. [ ] Inject all secrets from [dokploy-env.md](./dokploy-env.md) (no `REPLACE_ME` placeholders)
4. [ ] Confirm `DATABASE_URL` / `DIRECT_URL` point at compose service `postgres`
5. [ ] Confirm `REDIS_URL=redis://redis:6379`
6. [ ] Confirm `STORAGE_PROVIDER=minio` and MinIO credentials
7. [ ] Set Clerk + `CORS_ORIGIN` / `APP_URL` / `NEXT_PUBLIC_*` to production domains
8. [ ] Build & deploy; wait for `migrate` success then `api` / `worker` / `web` healthy
9. [ ] Probe: `api/live`, `worker/live`, `web/healthz`
10. [ ] Map domains to published ports; verify TLS at the proxy
11. [ ] Confirm worker does not exit (BullMQ consumers + HTTP `/live`)
12. [ ] Optional: ECR + [release.yml](../../.github/workflows/release.yml) for image promotion

Env matrix: [dokploy-env.md](./dokploy-env.md) · Runbook: [dokploy-runbook.md](./dokploy-runbook.md)
