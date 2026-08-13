# Production go-live (Dokploy + Docker Postgres/MinIO/Redis)

## What is already done in the repo

- `docker-compose.dokploy.yml` — builds web/api/worker + Docker Postgres, MinIO, Redis (no root Dockerfile)
- Env templates: [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example), [`dokploy-env.md`](./dokploy-env.md)
- Migrations fail fast on missing `POSTGRES_PASSWORD` / auth mismatch (entrypoint preflight)
- Release workflow can push to ECR later (optional); first launch uses compose **build**

## Blockers only you can clear

1. **Infra + app secrets** in Dokploy Environment UI  
   Paste [`dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example).  
   Interpolation-required: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.  
   Runtime: Clerk, `NEXT_PUBLIC_*`, `CORS_ORIGIN` / `APP_URL`. Entrypoints build `DATABASE_URL` from `POSTGRES_*`.

2. **DNS + TLS in Dokploy**
   - `admin.sdvedutech.in` → service `web` container port **3000**
   - `backend.sdvedutech.in` → service `api` container port **4000**
   - Worker listens on `4001` and remains internal
   - Clerk allowed origins / redirect URLs include `https://admin.sdvedutech.in`

3. **Clerk Dashboard (this app is the primary; `portal.nppetah.in` is the satellite)**
   - Application / Home URL: `https://admin.sdvedutech.in` (**not** `www.sdvedutech.in`)
   - Paths: Sign-in `/sign-in`, Sign-up `/sign-up`
   - Allowed origins / redirect allowlist: `https://admin.sdvedutech.in`, `https://portal.nppetah.in` (+ `http://localhost:3000` for local)
   - Satellite domain: `portal.nppetah.in` (same Clerk instance / live keys as admin)
   - Do **not** set `NEXT_PUBLIC_CLERK_IS_SATELLITE` on this admin app
   - If Account Portal custom domain `accounts.sdvedutech.in` is enabled, set its application URL to admin — or disable it for this app. Missing `NEXT_PUBLIC_CLERK_SIGN_IN_URL` previously sent `auth.protect()` to Account Portal, which then bounced to www.
   - After changing Dokploy `NEXT_PUBLIC_CLERK_*` path vars, **rebuild** the web image (not restart-only).

4. **EC2 security group** — expose only TCP `80`/`443` for Traefik. Do not allow public inbound access to application ports `3001`, `4000`, or `4001`.

## Dokploy deploy steps

0. **App type must be Docker Compose** — if you see `open Dockerfile: no such file`, follow [`dokploy-compose-setup.md`](./dokploy-compose-setup.md). Do **not** add a root Dockerfile.
1. Paste [`deploy/env/dokploy.compose.env.example`](../../deploy/env/dokploy.compose.env.example) into Dokploy **Environment** (replace all `REPLACE_ME_*`). Missing `MINIO_ROOT_USER` / `POSTGRES_PASSWORD` / etc. fails compose interpolation before start.
2. Deploy Compose file `docker-compose.dokploy.yml`, context = repo root. Do **not** paste a conflicting `DATABASE_URL` for in-compose Postgres.
3. Wait for `postgres` / `minio` / `redis` healthy, `migrate` success (`prisma migrate deploy` only — `No pending migrations to apply.` is OK), then `api` `/health` + `/ready`, then `web`.
   If migrate fails with auth / P1000: see [`dokploy-env.md`](./dokploy-env.md) § Prisma P1000 (volume password lock vs env drift).4. **First empty DB only:** run one-time catalog seed from a host that can reach Postgres (`SEED_DEMO=false` + your Clerk admin id) — see [`dokploy-env.md`](./dokploy-env.md). Without this, roles/permissions are missing and RBAC/bootstrap will fail. The seed upserts that Clerk user as global `ADMIN` when `SEED_ADMIN_CLERK_USER_ID` or `BOOTSTRAP_ADMIN_CLERK_USER_IDS` is set.
4. Set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` to your Clerk user id (`user_…` from Clerk Dashboard → Users) **before the first production sign-in**, then redeploy/restart **api**.
5. Open `https://admin.sdvedutech.in` and sign in. The dashboard returns HTTP 403 when the profile has no permissions (e.g. `PENDING_APPROVAL`); there is no Pending User dashboard screen. A 403 for every signed-in user (including bootstrap admins) usually means the web SSR `/users/me` parse is wrong or roles were never seeded — not Clerk itself.

### First admin receives HTTP 403

Chicken-and-egg: without bootstrap, the first signup gets `PENDING_APPROVAL` (0 permissions). Fix:

1. Ensure catalog seed has been run once (roles/permissions exist).
2. Copy your Clerk user id into Dokploy env: `BOOTSTRAP_ADMIN_CLERK_USER_IDS=user_xxxxx`
3. Redeploy/restart **api** so it picks up the env.
4. Reload the dashboard or sign in again so the API provisions the configured user as `ADMIN`.

Alternatively, promote an existing Clerk user explicitly from an environment
with database access:

```bash
pnpm admin:promote -- --clerk-user-id user_xxxxx
```

Manual seed notes: keep `SEED_DEMO=false` in production (catalog only). `SEED_DEMO=true` also seeds demo users/surveys (not for production). Do **not** set a static `REDIS_URL` in Dokploy — only `REDIS_PASSWORD` (compose builds the URL).

## Smoke test

```bash
curl -fsS https://backend.sdvedutech.in/health
curl -fsS https://backend.sdvedutech.in/ready
curl -fsSI https://admin.sdvedutech.in/
# Unauthenticated dashboard must redirect to in-app sign-in (not accounts.* / www):
curl -fsSI https://admin.sdvedutech.in/dashboard
# Expect Location: .../sign-in (same host admin.sdvedutech.in)
```

### Auth verification checklist

| Check                                | Local                                                                                              | Production                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Guest `/`                            | redirects to `/sign-in`                                                                            | same on `admin`                                          |
| Guest `/dashboard`                   | redirects to `/sign-in` (not Account Portal)                                                       | `Location` stays on `admin…/sign-in`                     |
| After sign-in                        | lands on `/dashboard`, or `portal.nppetah.in` when satellite `redirect_url` / Etah department role | same                                                     |
| Session cookie                       | host `localhost`                                                                                   | host `admin.sdvedutech.in` (no cross-subdomain required) |
| `x-clerk-auth-status` when signed in | not `signed-out` on protected routes                                                               | same                                                     |
| Dashboard 403 after auth             | set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` + catalog seed                                                | same                                                     |

Multi-domain / satellite sessions across `www` + `admin` are **out of scope** for this app.

## After first successful deploy

- Rotate Clerk / Maps keys that were shared earlier.
- Optional: switch images to ECR via release workflow.
- Schedule volume backups ([backup-restore.md](./backup-restore.md)).

## ETL (Convex → Postgres / MinIO) checklist

Only if live Convex survey sync is still required:

1. On self-hosted Convex: set `ETL_SECRET` (shared secret).
2. On Dokploy **api** and **worker** env: set `CONVEX_SITE_URL`, `ETL_CONVEX_SECRET` (= Convex `ETL_SECRET`), and on api `ETL_ENABLED=true` (optional cron).
3. Confirm worker is running (BullMQ consumers).
4. Seed geo catalog (Master Data → Tenants & Wards) before first sync.
5. Sign in as ADMIN (`etl:manage`) → Master Data → **Sync from Convex**, or open **Administration → ETL Sync**.
6. Confirm surveys in Postgres and photos under MinIO `etah-images/…` (see [ETL RUNBOOK](../etl/RUNBOOK.md)).
