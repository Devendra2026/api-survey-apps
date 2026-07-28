# Production deployment — Dokploy + Docker Swarm + Traefik

## Why Traefik returned 502 (historical)

Starting the **monorepo root** as a single application fails: root is workspace-only and has **no** app `start` script, so no healthy process remains → Swarm `0/1` replicas → Traefik **502**.

**Fix:** deploy via **Docker Compose** ([`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml)) or three application images (web / api / worker) built from Dockerfiles. Never run the monorepo root as one undifferentiated process. See [`DEPLOYMENT.md`](../../DEPLOYMENT.md).

---

## Services

| Service | Dockerfile               | Start                           | Port     | Health         | Traefik       |
| ------- | ------------------------ | ------------------------------- | -------- | -------------- | ------------- |
| web     | `apps/web/Dockerfile`    | `node apps/web/server.js`       | **3000** | `GET /healthz` | Yes           |
| api     | `apps/api/Dockerfile`    | `node apps/api/dist/main.js`    | **4000** | `GET /live`    | Yes           |
| worker  | `apps/worker/Dockerfile` | `node apps/worker/dist/main.js` | **4001** | `GET /live`    | No (internal) |

All bind `HOSTNAME=0.0.0.0`.

---

## Preferred: Dokploy Compose application

1. Create one Dokploy **Compose** application.
2. Compose file: `docker-compose.dokploy.yml`
3. Inject secrets via Dokploy **Environment** UI (see [dokploy-env.md](./dokploy-env.md) or `deploy/env/*.env.example`). On-disk `.env.production` is optional.
4. Domains via Dokploy domains **or** Traefik labels already on `web` / `api`:
   - `admin.sdvedutech.in` → web container port **3000**
   - `backend.sdvedutech.in` → api container port **4000**
5. Deploy. Wait for `migrate` → `api` / `worker` / `web` healthy.

### Critical Dokploy settings

| Setting    | Value                             |
| ---------- | --------------------------------- |
| Builder    | **Dockerfile** (Compose services) |
| Context    | Repository root                   |
| Do not set | Root Start Command / `pnpm start` |

---

## Alternative: three Dokploy Applications

Create separate apps; each uses its Dockerfile with **build context = repo root**.

### Web

| Field      | Value                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------- |
| Dockerfile | `apps/web/Dockerfile`                                                                         |
| Port       | `3000`                                                                                        |
| Health     | `/healthz`                                                                                    |
| Build args | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Env file   | `deploy/env/web.env.example` → secrets                                                        |

### API

| Field      | Value                        |
| ---------- | ---------------------------- |
| Dockerfile | `apps/api/Dockerfile`        |
| Port       | `4000`                       |
| Health     | `/live`                      |
| Env file   | `deploy/env/api.env.example` |

### Worker

| Field      | Value                           |
| ---------- | ------------------------------- |
| Dockerfile | `apps/worker/Dockerfile`        |
| Port       | `4001` (no public domain)       |
| Health     | `/live`                         |
| Env file   | `deploy/env/worker.env.example` |

Run migrations once before/with API:

```bash
docker run --rm --env-file api.env \
  --entrypoint sh api-survey-api:prod \
  /app/apps/api/docker-entrypoint.migrate.sh
```

---

## Docker Swarm + Traefik

```bash
docker network create --driver=overlay --attachable traefik-public
docker build -f apps/api/Dockerfile -t api-survey-api:prod .
docker build -f apps/web/Dockerfile -t api-survey-web:prod \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... .
docker build -f apps/worker/Dockerfile -t api-survey-worker:prod .

cp deploy/env/api.env.example deploy/env/api.env   # fill secrets
cp deploy/env/web.env.example deploy/env/web.env
cp deploy/env/worker.env.example deploy/env/worker.env

docker stack deploy -c deploy/docker-stack.swarm.yml survey
```

Traefik must share `traefik-public`. Labels route:

- Host(`admin…`) → `web:3000` health `/healthz`
- Host(`backend…`) → `api:4000` health `/live`

---

## Local production commands

```bash
pnpm install
pnpm build

pnpm --filter api start      # :4000
pnpm --filter web start      # :3000
pnpm --filter worker start   # :4001
```

Root has **no** `start` script — only workspace/build tooling.

---

## Health endpoints

| Service | Liveness           | Readiness                   |
| ------- | ------------------ | --------------------------- |
| api     | `/live`, `/health` | `/ready` (DB/Redis/storage) |
| worker  | `/live`            | `/ready` (Redis)            |
| web     | `/healthz`         | same (no upstream deps)     |

---

## Image size / optimization

- Multi-stage builds with `turbo prune <app> --docker`, Node 24, pnpm 11.17.0, BuildKit cache mounts
- Web: Next.js `output: "standalone"`
- API/worker runners: `node …/dist/main.js` (no pnpm in final image)
- Non-root users + `HEALTHCHECK` in every app image
- Worker: Debian slim + Playwright Chromium (larger by design)
- See also root [`DEPLOYMENT.md`](../../DEPLOYMENT.md)

---

## Env templates

- [`deploy/env/api.env.example`](../../deploy/env/api.env.example)
- [`deploy/env/web.env.example`](../../deploy/env/web.env.example)
- [`deploy/env/worker.env.example`](../../deploy/env/worker.env.example)
- Matrix: [dokploy-env.md](./dokploy-env.md)
