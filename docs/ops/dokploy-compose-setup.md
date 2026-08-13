# Dokploy Compose setup (exact UI steps)

**This monorepo has no root `Dockerfile` by design.** Production is **Docker Compose only**.

## If you see this error

### Wrong app type (root Dockerfile)

```text
ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

Recreate as **Docker Compose** — see §1. Do **not** add a root Dockerfile.

### Missing Environment secrets (your current Compose failure)

```text
error while interpolating services.minio-init.environment.MINIO_ROOT_USER:
required variable MINIO_ROOT_USER is missing a value
```

Compose type is fine. Dokploy **Environment** is empty/incomplete. Paste [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example) into Environment (replace `REPLACE_ME_*`), then redeploy.

Same class of error for: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD`, `DATABASE_URL`.

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

**Preferred:** open [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example), replace every `REPLACE_ME_*`, paste the whole file into Dokploy **Environment**, Save, Deploy.

Minimal paste (same keys):

```bash
POSTGRES_PASSWORD=REPLACE_ME_POSTGRES_PASSWORD
REDIS_PASSWORD=REPLACE_ME_REDIS_PASSWORD_URL_SAFE
MINIO_ROOT_USER=REPLACE_ME_MINIO_USER
MINIO_ROOT_PASSWORD=REPLACE_ME_MINIO_PASSWORD

# Host MUST be Compose service name `postgres` — NOT localhost
DATABASE_URL=postgresql://postgres:REPLACE_ME_POSTGRES_PASSWORD@postgres:5432/survey?schema=public
DIRECT_URL=postgresql://postgres:REPLACE_ME_POSTGRES_PASSWORD@postgres:5432/survey?schema=public

NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_ME
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
ETAH_PORTAL_URL=https://portal.nppetah.in
CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_ME
CLERK_SECRET_KEY=sk_live_REPLACE_ME
CLERK_AUTHORIZED_PARTIES=https://admin.sdvedutech.in,https://portal.nppetah.in

CORS_ORIGIN=https://admin.sdvedutech.in,https://portal.nppetah.in
APP_URL=https://admin.sdvedutech.in
DEMAND_NOTICE_PRINT_SECRET=REPLACE_ME_LONG_RANDOM

STORAGE_PROVIDER=minio
MINIO_BUCKET=api-survey-app
STORAGE_BUCKET=api-survey-app
NODE_ENV=production
```

- Keep `POSTGRES_PASSWORD` identical to the password inside `DATABASE_URL` / `DIRECT_URL`.
- Use a URL-safe `REDIS_PASSWORD` (avoid `@`, `:`, `/`). Do **not** set `REDIS_URL` — compose builds it from `REDIS_PASSWORD`.
- Interpolation vs runtime checklist: [dokploy-env.md](./dokploy-env.md).
- Optional: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, ETL vars — [dokploy-env.md](./dokploy-env.md).
- After first migrate on an empty DB, run one-time catalog seed — [dokploy-env.md](./dokploy-env.md) § One-time catalog seed.

## 3. Domains

| Host                    | Service | Container port | Dokploy Domains tip                          |
| ----------------------- | ------- | -------------- | -------------------------------------------- |
| `admin.sdvedutech.in`   | `web`   | **3000**       | Service `web`, port **3000** (not host 3001) |
| `backend.sdvedutech.in` | `api`   | **4000**       | Service `api`, port **4000**                 |

Compose attaches `web`/`api` to external `dokploy-network` so Traefik can reach them. Prefer Domains in the Dokploy UI (redeploy after adding). Do not set Environment `PORT=3001` for web.

Traefik is the only ingress. Compose does not publish `web`, `api`, or `worker` ports on the host. Use the container ports above for Traefik/Dokploy domains; keep the worker internal.

## 4. What Compose builds

| Service                        | Dockerfile               | Notes                                                            |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------- |
| `migrate` + `api`              | `apps/api/Dockerfile`    | `node:24-bookworm-slim` + OpenSSL; `turbo prune api`; Prisma CLI |
| `worker`                       | `apps/worker/Dockerfile` | Playwright Chromium; longer first build                          |
| `web`                          | `apps/web/Dockerfile`    | Next standalone; needs `NEXT_PUBLIC_*` at build                  |
| `postgres` / `redis` / `minio` | public images            | internal `app` network                                           |

Build context for every app image is **repository root** (`.`).

## 5. Deploy and verify

1. Click **Deploy**.
2. First build pulls/builds three app images (worker is slowest).
3. Order: infra healthy → `minio-init` (waits for MinIO healthy) → `migrate` OK → `api` / `worker` / `web` healthy.
4. Smoke:

```bash
curl -fsS https://backend.sdvedutech.in/live
curl -fsS https://backend.sdvedutech.in/ready
curl -fsSI https://admin.sdvedutech.in/
```

### Startup expectations

| Signal                                                                                                    | Meaning                                                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `minio-init` logs `Alias 'local' configured` then `Bucket '…' ready` with **no** `connection refused`     | MinIO race fixed — init gated on `service_healthy` + quiet retries             |
| `migrate` logs `✓ Loading environment` → `✓ Waiting for PostgreSQL` → `✓ Database reachable`              | Entrypoint preflight (host-only URL logged; credentials never printed)         |
| `migrate` logs `✓ Prisma migrate deploy` then applied migrations or **`No pending migrations to apply.`** | Success (idempotent). Only the `migrate` one-shot runs this; api/worker do not |
| `migrate` logs `✓ Finished successfully` (exit 0) — **no** seed step                                      | Migrate-only job complete; catalog seed is one-time manual (see dokploy-env)   |
| `migrate` / `minio-init` exit 0; no inherited `/live` healthcheck on migrate                              | One-shots stay one-shots (no false unhealthy / recreate loops)                 |

## 6. Fixing wrong or incomplete Compose apps

| Situation                                                             | Action                                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `open Dockerfile: no such file`                                       | Wrong type — use **Docker Compose**, not Application/Dockerfile                                                                                |
| `MINIO_ROOT_USER is missing a value` (e.g. `sdv-frontend-app-qrll5q`) | Paste [`dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example) into Environment                                           |
| Compose OK but migrate/api crash                                      | Check migrate logs for `✗` lines; `DATABASE_URL` host must be `postgres`; password must match `POSTGRES_PASSWORD`; Clerk + `NEXT_PUBLIC_*` set |

## Related

- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [dokploy-env.md](./dokploy-env.md)
- [dokploy-runbook.md](./dokploy-runbook.md)
- [go-live.md](./go-live.md)
