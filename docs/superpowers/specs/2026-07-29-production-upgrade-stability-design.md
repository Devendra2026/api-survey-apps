# Design: Production Upgrade & Stability Hardening

**Date:** 2026-07-29  
**Status:** Approved for implementation (dashboard policy A; hardening-first approach)  
**Supersedes / extends:** `2026-07-28-docker-dokploy-nixpacks-removal-design.md` (Docker topology unchanged)

## Goal

Bring the Turborepo monorepo to a maintainable, Dokploy-stable production baseline: latest mutually compatible stables, zero CI/build failures, hardened Compose/Docker, complete backup/restore, strict dashboard authorization for unauthorized users, and documented migration notes — **without changing survey/tax/ETL business domain logic**.

## Current baseline (as of design)

| Layer                    | Current                                     | Target posture                                                   |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| Node                     | 24 LTS (`.node-version`, engines `>=24`)    | Stay on latest Node 24.x LTS line; pin consistently in Docker/CI |
| pnpm                     | 11.17.0                                     | Latest 11.x compatible with workspace                            |
| Turbo                    | ^2.10.5                                     | Latest stable 2.x; refresh `turbo.json` per current schema       |
| Next.js / React          | 16.2.6 / 19.2.4                             | Latest stable 16.x / 19.x within peer range                      |
| NestJS                   | ^11.1.28                                    | Latest stable 11.x                                               |
| Prisma                   | ^7.8.0                                      | Latest stable 7.x; keep Prisma 7 config style                    |
| Clerk                    | `@clerk/nextjs` ^7.x, `@clerk/backend` ^3.x | Latest compatible majors already in use                          |
| Postgres / Redis / MinIO | 17 / 8 / pinned RELEASE                     | Keep majors; refresh MinIO pin to newest stable RELEASE          |
| Deploy                   | `docker-compose.dokploy.yml`                | Harden only; keep service set                                    |

The stack is already near-current. This effort is **hardening + gap closure**, not a greenfield rewrite.

## Approaches considered

### Approach 1 — Aggressive zero-warning rewrite

Force absolute latest of every package the same week, rewrite configs from scratch, chase every peer/deprecation warning to extinction, optionally restructure packages.

- **Pros:** Maximum “newness.”
- **Cons:** High regression risk; peer warnings often come from transitive deps outside our control; conflicts with “no business logic changes.”
- **Reject.**

### Approach 2 — Hardening-first compatibility pass (recommended)

1. Inventory and bump to latest **stable, mutually compatible** versions within current major lines (and Node 24 LTS).
2. Close known production gaps (backups, dashboard 403, Compose security, Clerk middleware, CLI promote, docs/CHANGELOG/report).
3. Fix only real errors/warnings we own; document unavoidable transitive peer noise if any remain after `pnpm` resolutions.
4. Validate with `turbo build|lint|typecheck|test` and Compose/Docker builds.

- **Pros:** Matches “stable for years” and YAGNI; preserves domain logic; Dokploy path already proven.
- **Cons:** Will not invent nonexistent majors (e.g. Next 17 if not stable).
- **Choose this.**

### Approach 3 — Phased multi-PR only

Same work as Approach 2, but strictly one PR per subsystem with long pauses.

- **Pros:** Easier review.
- **Cons:** Leaves production half-hardened longer; user’s prompt asks for a complete deliverable set.
- **Defer process preference to implementation plan tasks/commits; single design covers all phases.**

## Decisions

| Topic                                | Choice                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall approach                     | Approach 2 — hardening-first compatibility pass                                                                                                                        |
| Dashboard auth (clarification **A**) | Unauthorized dashboard access → **HTTP 403**; remove Pending User soft-gate for `(dashboard)`                                                                          |
| Who may access dashboard             | Authenticated users with **non-empty permissions** (assigned working role). Bootstrap list → `ADMIN` (existing). Empty / `PENDING_APPROVAL` only → 403                 |
| Why not bootstrap-IDs-only           | Prompt also requires **no business-logic regressions**; survey/ops roles already use the same web dashboard                                                            |
| Admin bootstrap                      | Keep `BOOTSTRAP_ADMIN_CLERK_USER_IDS` idempotent promotion; add **CLI** to promote any Clerk user to `ADMIN`                                                           |
| Backup layout                        | `scripts/backup/` + `scripts/restore/` writing to `/backups/YYYY-MM-DD/`; keep thin wrappers or move from `scripts/ops/`                                               |
| Compose service set                  | Unchanged: postgres, redis, minio, minio-init, migrate, api, worker, web                                                                                               |
| Host ports on Dokploy                | Prefer Traefik-only exposure; stop publishing app host ports when Traefik network is attached (or document SG lockdown if ports must remain for ops)                   |
| Swarm stack                          | Align Redis password with Dokploy or mark Swarm path deprecated in docs (Dokploy is primary)                                                                           |
| “Zero peer warnings”                 | Fail CI on errors; eliminate **direct** deprecated deps; use `pnpm.overrides` / peer deps only where safe; document any remaining transitive noise in the final report |
| Observability overlay                | Out of scope for this upgrade (optional compose remains)                                                                                                               |

## Architecture (unchanged topology)

```text
postgres + redis + minio (+ minio-init)
              ↓
     migrate (one-shot prisma migrate deploy + catalog seed)
              ↓
        api  +  worker
              ↓
             web  (Clerk) ──JWT──► api
```

Dokploy: single Compose app, external `dokploy-network`, Traefik labels on `web` and `api`.

## Design by workstream

### 1. Toolchain & Turborepo

- Pin Node 24 consistently: `.node-version`, `engines`, Dockerfile `ARG NODE_VERSION`, CI `setup-node`.
- Upgrade `turbo` to latest 2.x; keep `tasks` (not deprecated `pipeline`).
- Review `turbo.json`: outputs (exclude `.next/cache`, `.next/dev`), `dependsOn`, `globalDependencies`, task `env` / `globalEnv` for cache correctness.
- Align Dockerfile-installed turbo/pnpm versions with root `packageManager` / lockfile.
- Ensure `build`, `lint`, `typecheck`, `test`, `dev` pipelines remain correct for 3 apps + packages.

### 2. Framework dependency bumps

Bump within compatible majors (exact versions resolved at implement time from npm):

- Root: `turbo`, `typescript`, `eslint`, `prettier`
- `apps/web`: `next`, `react`, `react-dom`, `@clerk/nextjs`, eslint-config-next
- `apps/api` / `apps/worker`: `@nestjs/*`, `rxjs`, `class-validator`, `class-transformer`, `@clerk/backend` (api only)
- `packages/database`: `prisma`, `@prisma/client`
- `packages/ui`: `react`, `react-dom` aligned with web
- Shared: `zod` and other workspace peers kept in sync

Process: `pnpm update` within ranges → fix compile/lint → lockfile commit. No Nest/Next major jumps beyond what is stable and peer-compatible.

### 3. Prisma & migrate

- Keep Prisma 7 `prisma.config.ts` + generated client under `packages/database`.
- Dokploy `migrate` service remains the single migrate runner (`service_completed_successfully` before api/worker).
- Verify entrypoint: `migrate deploy` once, fail closed on bad `DATABASE_URL`, optional seed gated by `SKIP_DB_SEED`.
- No schema/business migration changes unless required by Prisma upgrade (then additive-only).

### 4. Docker / Compose / Dokploy

- Refresh healthchecks, `depends_on` conditions, restart/update policies (keep `start-first` where present).
- Redis: requirepass + AOF (Dokploy already); ensure local vs prod differences documented.
- MinIO: bump RELEASE pins for server + `mc`; keep prod bucket private; local may keep anonymous download for DX but document divergence.
- Dockerfiles: keep multi-stage prune pattern; verify non-root, BuildKit caches, standalone web output.
- Env: ensure web receives Clerk secrets at runtime; document build-arg vs runtime matrix in `docs/ops/dokploy-env.md`.
- Validate: `docker compose -f docker-compose.dokploy.yml config`.

### 5. Backup & restore

Replace/extend ops notes with executable scripts:

```text
scripts/backup/postgres.sh
scripts/backup/redis.sh
scripts/backup/minio.sh
scripts/backup/all.sh          # single entry for Dokploy terminal
scripts/restore/postgres.sh
scripts/restore/redis.sh
scripts/restore/minio.sh
scripts/restore/all.sh
```

- Output root: `/backups/YYYY-MM-DD/` (override with `BACKUP_ROOT`).
- Postgres: custom-format or gzip SQL + timestamp (prefer consistent with existing custom+gzip).
- Redis: `BGSAVE` / copy RDB (and note AOF) via `redis-cli` with auth.
- MinIO: `mc mirror` to backup dir.
- Support copy-offbox via documented `rsync`/`scp` examples.
- README: `docs/ops/backup-restore.md` rewritten for these scripts; leave `scripts/ops/backup-pg.sh` as thin wrappers calling new scripts **or** delete after pointing docs (prefer wrappers for one release to avoid breaking muscle memory).

### 6. Clerk

- Web: replace bare `clerkMiddleware()` with explicit public route matcher (sign-in/sign-up, `healthz`, static) and protect everything else.
- Confirm publishable/secret key usage for prod; authorized parties.
- Remove deprecated Clerk APIs if any appear during upgrade.
- Keep API `ClerkAuthGuard` + bootstrap provisioning.

### 7. Dashboard authorization (policy A)

**Server (web):**

- `(dashboard)/layout.tsx`: after `auth.protect()`, resolve current user permissions (server-side API call or session claim strategy already used by the app). If no usable permissions → `forbidden()` / 403 response (Next.js App Router).
- Remove Pending User branch from `ProtectedDashboardLayout` (client soft-gate).

**API:**

- Unchanged permission model for domain routes.
- Bootstrap + `PENDING_APPROVAL` assignment for non-bootstrap users without roles remains for **user management** by admins; those users simply cannot open the dashboard UI (403).

**CLI:**

- `pnpm` script (e.g. under `apps/api` or `packages/database`) accepting Clerk user id → ensure `ADMIN` role idempotently (reuse `RoleProvisioningService` logic or shared DB helper).

### 8. Production hardening

- Env validation already in API — extend examples for bootstrap/Clerk gaps in `.env.example`.
- Confirm graceful shutdown / health `/live` `/ready` / `/healthz`.
- No insecure production defaults (fail-closed passwords in Dokploy compose already).
- Logging: keep structured logs; no secret leakage.

### 9. Cleanup

- Remove dead Docker/Nixpacks leftovers if any remain.
- Deduplicate backup scripts after migration.
- Align deprecated nav exports only if unused (do not drive a UI redesign).
- Unused dependency prune via `pnpm` / knip-style only where confident.

### 10. CI / validation / deliverables

CI must pass:

- `turbo build`, `turbo lint`, `turbo typecheck`, `turbo test`
- Docker image builds for api/web/worker
- `docker compose … config` for dokploy file

Deliverables to land in-repo:

1. Updated lockfile + package.json versions
2. Updated `turbo.json` / Dockerfiles / `docker-compose*.yml`
3. Prisma config if touched
4. Clerk middleware / dashboard 403
5. Backup + restore scripts + README
6. Env documentation updates
7. `docs/superpowers/migrations/2026-07-29-production-upgrade-notes.md`
8. `CHANGELOG.md` entry
9. `docs/superpowers/reports/2026-07-29-production-upgrade-report.md` — issues found, why, how fixed

## Error handling

| Case                   | Behavior                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| Migrate fails          | api/worker never start (`service_completed_successfully`)                |
| Missing bootstrap list | No auto-admin; first users stay pending; dashboard 403 until CLI/promote |
| Backup missing tools   | Scripts exit non-zero with clear stderr                                  |
| Clerk misconfig        | API fails closed in production (existing validation)                     |

## Testing

- Unit: role provisioning + any new promote CLI helper
- Web: dashboard layout returns 403 when permissions empty (component/route test if present; else manual checklist)
- CI full turbo matrix
- Compose config validation
- Optional local smoke: backup scripts against local compose services

## Out of scope

- Domain schema/feature work (surveys, tax, ETL algorithms)
- Multi-region DR / automated offsite scheduler (scripts + docs only)
- Observability stack redesign
- Remote Turbo cache vendor setup (config compatibility only)
- Absolute elimination of all transitive peer warnings from third parties when overrides would be unsafe

## Spec self-review

- No TBD placeholders for dashboard policy, approach, or service set.
- Topology matches existing Dokploy design; no contradiction with nixpacks-removal spec.
- Scope is one implementation plan with phased tasks (toolchain → apps → infra → auth → backups → docs/validate).
- “Administrators only” reconciled explicitly with multi-role dashboard to satisfy both auth hardening and no business-logic regression.
