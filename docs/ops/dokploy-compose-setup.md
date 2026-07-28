# Dokploy Compose setup (exact UI steps)

**This monorepo has no root `Dockerfile` by design.** Production is **Docker Compose only**.

## If you see this error

```text
ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

Dokploy app (e.g. `sdv-dashboard-jpnilc`) is building as a **single Docker** application and looking for `/Dockerfile`. That will never work here.

**Do not add a root Dockerfile.** Fix Dokploy instead:

1. Create a **new** application → type **Docker Compose** (not Docker / Nixpacks / Railpack), **or**
2. Change the existing app’s build type to **Compose** if your Dokploy version allows it.

Then set compose file = `docker-compose.dokploy.yml` and redeploy.

---

## 1. Create the right application type

1. Dokploy → **Create** → **Docker Compose**.
2. Connect this Git repository.
3. Set:

| Field                          | Value                                |
| ------------------------------ | ------------------------------------ |
| Application type               | **Docker Compose**                   |
| Compose file                   | `docker-compose.dokploy.yml`         |
| Build context / base directory | repository root (`.` or leave empty) |
| Auto-deploy                    | optional (on push to `main`)         |

4. Do **not** set:

- Dockerfile path = `Dockerfile` (there is none)
- Root start command / `pnpm start`
- Nixpacks / Railpack

5. Save → open **Environment**.

## 2. Required environment variables

Dokploy writes these to `.env`. Compose loads `.env` into `migrate` / `api` / `worker` / `web`.

```bash
POSTGRES_PASSWORD=CHANGE_ME_STRONG
REDIS_PASSWORD=CHANGE_ME_URL_SAFE
MINIO_ROOT_USER=CHANGE_ME_USER
MINIO_ROOT_PASSWORD=CHANGE_ME_STRONG

# Host MUST be Compose service name `postgres` — NOT localhost
DATABASE_URL=postgresql://postgres:CHANGE_ME_STRONG@postgres:5432/survey?schema=public
DIRECT_URL=postgresql://postgres:CHANGE_ME_STRONG@postgres:5432/survey?schema=public

NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_AUTHORIZED_PARTIES=https://admin.sdvedutech.in

CORS_ORIGIN=https://admin.sdvedutech.in
APP_URL=https://admin.sdvedutech.in
DEMAND_NOTICE_PRINT_SECRET=CHANGE_ME_LONG_RANDOM

STORAGE_PROVIDER=minio
MINIO_BUCKET=api-survey-app
STORAGE_BUCKET=api-survey-app
```

- Keep `POSTGRES_PASSWORD` identical to the password inside `DATABASE_URL` / `DIRECT_URL`.
- Use a URL-safe `REDIS_PASSWORD` (avoid `@`, `:`, `/`).
- Optional: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, ETL vars — [dokploy-env.md](./dokploy-env.md).

## 3. Domains

| Host                    | Service | Container port |
| ----------------------- | ------- | -------------- |
| `admin.sdvedutech.in`   | `web`   | **3000**       |
| `backend.sdvedutech.in` | `api`   | **4000**       |

Use container ports for Traefik/Dokploy domains (not host publish `3001`).

## 4. What Compose builds

| Service                        | Dockerfile               | Notes                                                     |
| ------------------------------ | ------------------------ | --------------------------------------------------------- |
| `migrate` + `api`              | `apps/api/Dockerfile`    | `turbo prune api --docker`; Prisma CLI linked for migrate |
| `worker`                       | `apps/worker/Dockerfile` | Playwright Chromium; longer first build                   |
| `web`                          | `apps/web/Dockerfile`    | Next standalone; needs `NEXT_PUBLIC_*` at build           |
| `postgres` / `redis` / `minio` | public images            | internal `app` network                                    |

Build context for every app image is **repository root** (`.`).

## 5. Deploy and verify

1. Click **Deploy**.
2. First build pulls/builds three app images (worker is slowest).
3. Order: infra healthy → `minio-init` → `migrate` OK → `api` / `worker` / `web` healthy.
4. Smoke:

```bash
curl -fsS https://backend.sdvedutech.in/live
curl -fsS https://backend.sdvedutech.in/ready
curl -fsSI https://admin.sdvedutech.in/
```

## 6. Fixing `sdv-dashboard-jpnilc` (wrong type today)

| Wrong                         | Right                                                       |
| ----------------------------- | ----------------------------------------------------------- |
| Application type: **Docker**  | Application type: **Docker Compose**                        |
| Looking for root `Dockerfile` | Compose file: `docker-compose.dokploy.yml`                  |
| Single process / Nixpacks     | Services: postgres, redis, minio, migrate, api, worker, web |

Preferred path: create a **new Compose** app with the settings above, attach domains, then remove the old Docker app. Do not invent a root multi-process Dockerfile.

## Related

- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [dokploy-env.md](./dokploy-env.md)
- [dokploy-runbook.md](./dokploy-runbook.md)
- [go-live.md](./go-live.md)
