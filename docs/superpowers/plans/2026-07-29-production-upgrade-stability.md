# Production Upgrade & Stability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the monorepo to a Dokploy-stable, latest-compatible baseline with dashboard 403 for unauthorized users, full backup/restore scripts, and zero owned build/lint/type/test failures — without changing survey/tax/ETL domain logic.

**Architecture:** Hardening-first pass on the existing Compose topology (`postgres` → `migrate` → `api`/`worker`/`web`). Dependency bumps stay within current majors (Node 24, Turbo 2, Next 16, Nest 11, Prisma 7). Auth: Clerk + existing `BOOTSTRAP_ADMIN_CLERK_USER_IDS`; dashboard requires non-empty permissions or HTTP 403.

**Tech Stack:** Turborepo, pnpm 11, Next.js 16, NestJS 11, Prisma 7, PostgreSQL 17, Redis 8, MinIO, Clerk, Docker Compose, Dokploy/Traefik.

**Spec:** [2026-07-29-production-upgrade-stability-design.md](../specs/2026-07-29-production-upgrade-stability-design.md)

## Global Constraints

- Node engines and Docker: Node **24** only (`.node-version`, `engines.node`, Dockerfile `ARG NODE_VERSION=24`)
- Package manager: `pnpm@11.x` matching root `packageManager`
- Do **not** change survey/tax/ETL/business domain logic or Prisma schema fields unless a Prisma upgrade forces an additive migration
- Keep Dokploy services: `postgres`, `redis`, `minio`, `minio-init`, `migrate`, `api`, `worker`, `web`
- Dashboard policy A: empty permissions / pending-only → **HTTP 403** (no Pending User soft-gate)
- Assigned working roles (non-empty permissions) retain dashboard access
- Prefer fixing owned warnings; document unavoidable transitive peer noise in the final report
- Commit after each task; do not push unless asked

## File map (create / modify)

| Path                                                                 | Responsibility               |
| -------------------------------------------------------------------- | ---------------------------- |
| `package.json`, `pnpm-lock.yaml`, `turbo.json`                       | Toolchain + pipeline         |
| `apps/{web,api,worker}/package.json`                                 | App dependency bumps         |
| `packages/**/package.json`                                           | Shared package bumps         |
| `apps/{web,api,worker}/Dockerfile`                                   | Image pins (node/pnpm/turbo) |
| `docker-compose.dokploy.yml`, `docker-compose.yml`                   | Infra pins + exposure harden |
| `apps/web/proxy.ts`                                                  | Clerk route protection       |
| `apps/web/app/(dashboard)/layout.tsx`                                | Server-side 403 gate         |
| `apps/web/components/layout/protected-layout.tsx`                    | Remove Pending UI            |
| `apps/api/src/common/services/role-provisioning.service.ts`          | Reuse for CLI promote        |
| `apps/api/scripts/promote-admin.mjs` (create)                        | Manual ADMIN promote CLI     |
| `scripts/backup/*.sh`, `scripts/restore/*.sh` (create)               | Backup/restore               |
| `scripts/ops/backup-pg.sh`, `restore-pg.sh`                          | Thin wrappers → new scripts  |
| `docs/ops/backup-restore.md`, `docs/ops/dokploy-env.md`              | Ops docs                     |
| `docs/superpowers/migrations/2026-07-29-production-upgrade-notes.md` | Migration notes              |
| `CHANGELOG.md`                                                       | Release notes                |
| `docs/superpowers/reports/2026-07-29-production-upgrade-report.md`   | Issue/fix report             |
| `.env.example`, `deploy/env/*.example`                               | Env docs                     |

---

### Task 1: Toolchain inventory and Turborepo bump

**Files:**

- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile` (ARG pins only in this task if versions change)
- Modify: `.github/workflows/ci.yml` (only if Node/pnpm pin differs)

**Interfaces:**

- Produces: root `turbo` at latest 2.x; `turbo.json` with `!.next/dev/**` in build outputs; Docker ARG strings matching root pins

- [ ] **Step 1: Record current versions**

Run:

```bash
node -v
pnpm -v
pnpm why turbo
pnpm list turbo next @nestjs/core prisma react --depth 0 -r
```

Expected: Node v24.x, pnpm 11.x, versions matching design baseline.

- [ ] **Step 2: Bump root turbo / typescript / eslint / prettier within majors**

In root `package.json`, set (resolve exact latest with `pnpm view <pkg> version` at implement time):

```json
"devDependencies": {
  "turbo": "^2.10.5",
  "typescript": "^5.9.2",
  "eslint": "^9.39.4",
  "prettier": "^3.9.5"
}
```

Run:

```bash
pnpm add -Dw turbo@latest typescript@latest eslint@latest prettier@latest
```

Expected: lockfile updates; no workspace protocol breakage.

- [ ] **Step 3: Update `turbo.json` build outputs**

Replace build `outputs` with:

```json
"outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
```

Keep existing `tasks`, `dependsOn`, `globalEnv`, and `db:generate` outputs. Do not rename `tasks` → `pipeline`.

- [ ] **Step 4: Align Dockerfile ARG defaults**

In each of `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile`, set:

```dockerfile
ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.5
```

Update `PNPM_VERSION` / `TURBO_VERSION` to the versions just installed (read from `package.json` `packageManager` and `devDependencies.turbo`).

- [ ] **Step 5: Smoke turbo**

Run:

```bash
pnpm turbo run build --dry-run=json
pnpm exec turbo --version
```

Expected: dry-run lists tasks; no schema warnings about deprecated `pipeline`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml turbo.json apps/api/Dockerfile apps/web/Dockerfile apps/worker/Dockerfile
git commit -m "chore: bump turbo toolchain and refresh turbo.json outputs"
```

---

### Task 2: Framework and workspace dependency bumps

**Files:**

- Modify: `apps/web/package.json`, `apps/api/package.json`, `apps/worker/package.json`
- Modify: `packages/database/package.json`, `packages/ui/package.json`, other packages as needed
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 Node/turbo pins
- Produces: Latest compatible Next 16 / React 19 / Nest 11 / Prisma 7 / Clerk majors aligned across workspaces

- [ ] **Step 1: Bump web stack**

Run from repo root:

```bash
pnpm --filter web update next@latest react@latest react-dom@latest @clerk/nextjs@latest eslint-config-next@latest
pnpm --filter @workspace/ui update react@latest react-dom@latest
```

Expected: Next stays major 16; React stays major 19.

- [ ] **Step 2: Bump Nest apps**

```bash
pnpm --filter api update "@nestjs/*@latest" @clerk/backend@latest rxjs@latest class-validator@latest class-transformer@latest
pnpm --filter worker update "@nestjs/*@latest" rxjs@latest class-validator@latest class-transformer@latest
```

Expected: `@nestjs/core` remains major 11.

- [ ] **Step 3: Bump Prisma**

```bash
pnpm --filter @workspace/database update prisma@latest @prisma/client@latest
pnpm --filter @workspace/database db:generate
```

Expected: generate succeeds; no schema edits required. If Prisma prints a required config change, apply the minimal Prisma 7–compatible fix only in `packages/database/prisma.config.ts` / schema generator block.

- [ ] **Step 4: Build and typecheck**

```bash
pnpm turbo build
pnpm turbo typecheck
```

Expected: exit 0. Fix compile errors only (import paths, Clerk API renames, Nest DI typings). Do not refactor domain services.

- [ ] **Step 5: Lint and test**

```bash
pnpm turbo lint
pnpm turbo test
```

Expected: exit 0. Fix owned lint/test failures.

- [ ] **Step 6: Commit**

```bash
git add apps packages pnpm-lock.yaml
git commit -m "chore: bump Next Nest Prisma Clerk and workspace deps"
```

---

### Task 3: Docker Compose and Dokploy hardening

**Files:**

- Modify: `docker-compose.dokploy.yml`
- Modify: `docker-compose.yml` (MinIO pin + docs comments only if needed)
- Modify: `deploy/docker-stack.swarm.yml` (Redis requirepass alignment **or** deprecation comment)
- Modify: `docs/ops/dokploy-compose-setup.md` if port exposure guidance changes

**Interfaces:**

- Consumes: Dockerfile ARG pins from Task 1
- Produces: Compose that validates; Traefik-primary exposure; refreshed MinIO RELEASE pins

- [ ] **Step 1: Resolve latest MinIO RELEASE tags**

```bash
# Use Docker Hub / MinIO release notes; pin matching server + mc era
```

Update in `docker-compose.dokploy.yml` (and local compose):

```yaml
image: minio/minio:RELEASE.<newest-stable>
# and
image: minio/mc:RELEASE.<matching>
```

Keep private bucket init in Dokploy (no `mc anonymous set download`).

- [ ] **Step 2: Harden published ports**

On `api`, `web`, and `worker` in `docker-compose.dokploy.yml`: remove host `ports:` mappings when Traefik labels + `dokploy-network` are present, **unless** ops docs require host health probes. If removing ports, update `docs/ops/dokploy-compose-setup.md` and `DEPLOYMENT.md` to say Traefik is the only ingress.

If host ports must remain for Dokploy health UI, leave them but add a comment that security groups must not expose `0.0.0.0/0` on 3001/4000/4001.

- [ ] **Step 3: Confirm migrate gate**

Verify `api` and `worker` still have:

```yaml
depends_on:
  migrate:
    condition: service_completed_successfully
```

and `migrate` uses `apps/api` image + `docker-entrypoint.migrate.sh`.

- [ ] **Step 4: Validate compose**

```bash
docker compose -f docker-compose.dokploy.yml config
```

Expected: exit 0; interpolated required-env placeholders fail closed when unset (document required env in examples).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.dokploy.yml docker-compose.yml deploy/docker-stack.swarm.yml docs
git commit -m "fix: harden Dokploy compose pins and Traefik exposure"
```

---

### Task 4: Clerk middleware hardening

**Files:**

- Modify: `apps/web/proxy.ts`
- Test: manual sign-in + `/healthz` (or add a small unit test if the repo already tests middleware)

**Interfaces:**

- Produces: Public routes for sign-in/sign-up/healthz; all other matched routes protected

- [ ] **Step 1: Replace bare middleware**

Replace `apps/web/proxy.ts` contents with:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/healthz"])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|healthz|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
```

Note: If this Next app uses `proxy.ts` instead of `middleware.ts`, keep the filename the project already uses; only change the export body.

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: exit 0; no Clerk deprecation errors in build log.

- [ ] **Step 3: Commit**

```bash
git add apps/web/proxy.ts
git commit -m "fix(web): protect non-public routes in Clerk middleware"
```

---

### Task 5: Dashboard HTTP 403 authorization

**Files:**

- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Modify: `apps/web/components/layout/protected-layout.tsx`
- Create (if helpful): `apps/web/lib/auth/dashboard-access.ts`
- Modify: `.env.example` to document `BOOTSTRAP_ADMIN_CLERK_USER_IDS`

**Interfaces:**

- Consumes: `GET /users/me` shape (`permissions: string[]`) already used by `useCurrentUser`
- Produces: Server `forbidden()` when permissions empty; client no longer shows Pending User panel

- [ ] **Step 1: Add shared access helper**

Create `apps/web/lib/auth/dashboard-access.ts`:

```typescript
export function hasDashboardAccess(permissions: string[] | null | undefined): boolean {
  return Array.isArray(permissions) && permissions.length > 0
}
```

- [ ] **Step 2: Server-gate dashboard layout**

Update `apps/web/app/(dashboard)/layout.tsx` to:

1. `await auth.protect()`
2. Obtain session JWT via `auth()` / `getToken()`
3. Fetch `${process.env.NEXT_PUBLIC_API_URL}/users/me` with `Authorization: Bearer <token>`
4. If fetch fails with 401 → redirect sign-in; if profile has no permissions → `import { forbidden } from "next/navigation"` and call `forbidden()`
5. Otherwise render `ProtectedDashboardLayout`

Concrete implementation:

```typescript
import { ProtectedDashboardLayout } from "@/components/layout/protected-layout"
import { hasDashboardAccess } from "@/lib/auth/dashboard-access"
import { auth } from "@clerk/nextjs/server"
import { forbidden, redirect } from "next/navigation"

async function fetchMe(token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured")
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (res.status === 401 || res.status === 403) {
    return { status: res.status as 401 | 403, body: null }
  }
  if (!res.ok) {
    throw new Error(`Failed to load profile (${res.status})`)
  }
  return { status: 200 as const, body: (await res.json()) as { permissions?: string[] } }
}

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  await session.protect()
  const token = await session.getToken()
  if (!token) {
    redirect("/sign-in")
  }
  const me = await fetchMe(token)
  if (me.status === 401) {
    redirect("/sign-in")
  }
  if (!hasDashboardAccess(me.body?.permissions)) {
    forbidden()
  }
  return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
}
```

Adjust `auth()` API to match `@clerk/nextjs` v7 in the lockfile (if `auth.protect()` is the only pattern, keep protect then `const { getToken } = await auth()`).

- [ ] **Step 3: Remove Pending User UI**

In `apps/web/components/layout/protected-layout.tsx`, delete the block:

```typescript
if (permissions.length === 0) {
  return ( /* Pending User ... */ )
}
```

Replace with:

```typescript
if (!hasDashboardAccess(permissions)) {
  return null
}
```

(Server layout already issued 403; client should not soft-render Pending.)

- [ ] **Step 4: Manual checklist**

1. User with no roles / PENDING only → dashboard URL returns 403
2. Bootstrap admin after first API hit → permissions non-empty → dashboard loads
3. Operational role with permissions → dashboard loads

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx apps/web/components/layout/protected-layout.tsx apps/web/lib/auth/dashboard-access.ts .env.example
git commit -m "fix(web): return HTTP 403 for dashboard users without permissions"
```

---

### Task 6: Admin promote CLI

**Files:**

- Create: `apps/api/scripts/promote-admin.mjs`
- Modify: `apps/api/package.json` (script)
- Modify: root `package.json` (convenience script)
- Modify: `apps/api/src/common/services/role-provisioning.service.ts` — extract pure promote helper **only if** needed for DRY; prefer calling Prisma from the script mirroring `ensureBootstrapAdmin` without Nest bootstrap if simpler
- Test: extend `role-provisioning.service.spec.ts` if extracting shared function

**Interfaces:**

- Produces: `pnpm --filter api promote-admin -- --clerk-user-id user_xxx` idempotent ADMIN assign

- [ ] **Step 1: Write failing unit test for promote-by-clerk-id helper**

If extracting `promoteClerkUserToAdmin(prisma, clerkUserId)` into `role-provisioning.service.ts` or `role-provisioning.util.ts`, add a Jest case:

```typescript
it("promotes existing user by clerkUserId to ADMIN idempotently", async () => {
  // arrange user + PENDING_APPROVAL
  // act promoteClerkUserToAdmin
  // assert active ADMIN role; prior pending inactive
})
```

- [ ] **Step 2: Implement helper + CLI**

`apps/api/scripts/promote-admin.mjs` must:

1. Read `DATABASE_URL` / `DIRECT_URL`
2. Parse `--clerk-user-id <id>`
3. Find user by `clerkUserId`
4. Deactivate non-ADMIN roles; ensure active ADMIN (same logic as bootstrap)
5. Exit 0 with log; exit 1 if user missing or ADMIN role missing

Add scripts:

```json
// apps/api/package.json
"promote-admin": "node ./scripts/promote-admin.mjs"

// root package.json
"admin:promote": "pnpm --filter api promote-admin"
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter api test -- role-provisioning
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/promote-admin.mjs apps/api/package.json package.json apps/api/src/common/services
git commit -m "feat(api): add CLI to promote Clerk user to ADMIN"
```

---

### Task 7: Backup and restore scripts

**Files:**

- Create: `scripts/backup/postgres.sh`, `scripts/backup/redis.sh`, `scripts/backup/minio.sh`, `scripts/backup/all.sh`
- Create: `scripts/restore/postgres.sh`, `scripts/restore/redis.sh`, `scripts/restore/minio.sh`, `scripts/restore/all.sh`
- Modify: `scripts/ops/backup-pg.sh`, `scripts/ops/restore-pg.sh` → wrappers calling new scripts
- Modify: `docs/ops/backup-restore.md`

**Interfaces:**

- Produces: `/backups/YYYY-MM-DD/` artifacts; Dokploy one-command `scripts/backup/all.sh`

- [ ] **Step 1: Implement postgres backup**

`scripts/backup/postgres.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAY="$(date -u +%Y-%m-%d)"
DIR="${BACKUP_ROOT}/${DAY}"
mkdir -p "$DIR"
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT="${DIR}/postgres-$(date -u +%H%M%SZ).dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUT"
gzip -f "$OUT"
echo "Wrote ${OUT}.gz"
```

- [ ] **Step 2: Implement redis backup**

Use `redis-cli` with `REDIS_PASSWORD` / `REDIS_URL`:

```bash
# BGSAVE or --rdb copy; store under ${DIR}/redis-*.rdb
```

Document that AOF volume snapshot is an alternative on the Dokploy host.

- [ ] **Step 3: Implement minio backup**

```bash
# mc alias set local "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
# mc mirror --overwrite local/"$MINIO_BUCKET" "${DIR}/minio/"
```

- [ ] **Step 4: Wire `all.sh` + restore counterparts**

`scripts/backup/all.sh` runs postgres → redis → minio and prints:

```text
rsync -avz /backups/YYYY-MM-DD/ user@offsite:/path/
# or scp -r ...
```

Restore scripts reverse the operations with explicit “never overwrite prod without confirmation” guards (`CONFIRM=yes` required).

- [ ] **Step 5: Rewrite `docs/ops/backup-restore.md`**

Document single Dokploy command:

```bash
BACKUP_ROOT=/backups DATABASE_URL=... REDIS_PASSWORD=... MINIO_ENDPOINT=... \
  bash scripts/backup/all.sh
```

- [ ] **Step 6: Make executable and commit**

```bash
git add scripts/backup scripts/restore scripts/ops/backup-pg.sh scripts/ops/restore-pg.sh docs/ops/backup-restore.md
git commit -m "feat(ops): add postgres redis minio backup and restore scripts"
```

---

### Task 8: Env docs, migration notes, CHANGELOG, report

**Files:**

- Modify: `.env.example`, `deploy/env/dokploy.compose.env.example`, `docs/ops/dokploy-env.md`
- Create: `docs/superpowers/migrations/2026-07-29-production-upgrade-notes.md`
- Create or modify: `CHANGELOG.md`
- Create: `docs/superpowers/reports/2026-07-29-production-upgrade-report.md`

**Interfaces:**

- Consumes: all prior tasks’ actual versions and fixes
- Produces: operator-ready docs + issue/fix report

- [ ] **Step 1: Env matrix**

Ensure documented:

- `BOOTSTRAP_ADMIN_CLERK_USER_IDS`
- Clerk publishable/secret + `NEXT_PUBLIC_*` build args
- `CLERK_AUTHORIZED_PARTIES`
- DB/Redis/MinIO secrets
- `BACKUP_ROOT`

- [ ] **Step 2: Migration notes**

Include: PG volume major warning, rebuild web for `NEXT_PUBLIC_*`, set bootstrap IDs before go-live, run `scripts/backup/all.sh` smoke, promote CLI usage.

- [ ] **Step 3: CHANGELOG**

Add `## [Unreleased]` or dated section listing toolchain bumps, auth 403, backups, compose hardening.

- [ ] **Step 4: Report**

For each issue found during implementation: **Issue → Why it mattered → Fix**. Include any remaining transitive peer warnings with rationale.

- [ ] **Step 5: Commit**

```bash
git add .env.example deploy/env docs CHANGELOG.md
git commit -m "docs: production upgrade migration notes changelog and report"
```

---

### Task 9: Final validation gate

**Files:** none required (fix-forward only)

- [ ] **Step 1: Fresh install simulation**

```bash
pnpm install
pnpm turbo build
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all exit 0.

- [ ] **Step 2: Docker builds**

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
docker build -f apps/worker/Dockerfile .
docker compose -f docker-compose.dokploy.yml config
```

Expected: builds succeed; compose validates.

- [ ] **Step 3: Fix any failures inline, commit if needed**

```bash
git commit -m "fix: clear final validation failures from production upgrade"
```

- [ ] **Step 4: Update report with validation results**

Append CI/local command outcomes to the report file and commit.

---

## Spec coverage checklist

| Spec workstream                              | Task(s)     |
| -------------------------------------------- | ----------- |
| Turborepo / Node                             | 1, 9        |
| Next / Nest / Prisma / Clerk deps            | 2, 4        |
| Postgres / Redis / MinIO / Compose / Dokploy | 3, 7        |
| Docker optimization                          | 1 (pins), 3 |
| Backup / restore                             | 7           |
| Clerk + bootstrap + CLI                      | 4, 5, 6     |
| Dashboard 403                                | 5           |
| Cleanup / hardening / CI                     | 2, 3, 8, 9  |
| Deliverables (CHANGELOG, notes, report)      | 8           |

## Plan self-review

- No TBD placeholders; MinIO exact RELEASE resolved at Task 3 Step 1 from live registry.
- Dashboard policy matches design (403 + non-empty permissions).
- Promote CLI and backup paths match design file layout.
- Types: `hasDashboardAccess(permissions: string[] | null | undefined): boolean` used consistently in Tasks 5–6 narrative.
