# Production Readiness Report

Date: 2026-07-17  
Scope: Make the Turborepo production-ready (`pnpm install|lint|typecheck|build|test|dev` + GitHub Actions CI).

---

## 1. Files changed

### CI / tooling

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — Redis service, Node `22.12`, `test:ci`, worker Docker build
- [`package.json`](../package.json) — root `test` script; removed `turbo-cli`; ESLint 9 alignment
- [`turbo.json`](../turbo.json) — `test` task
- [`lint-staged.config.mjs`](../lint-staged.config.mjs) — worker, jobs, excel-reports coverage
- [`apps/api/package.json`](../apps/api/package.json) — `test:ci`, `passWithNoTests`, ESLint 9, removed unused `uuid`
- [`apps/api/scripts/run-jest.mjs`](../apps/api/scripts/run-jest.mjs) — (unchanged; CI no longer depends on fragile `--` forwarding)
- [`apps/api/test/jest-e2e.json`](../apps/api/test/jest-e2e.json) — ESM + `passWithNoTests`

### Docker

- [`apps/worker/Dockerfile`](../apps/worker/Dockerfile) — real multi-stage Nest build (replaced stub)
- [`apps/web/Dockerfile`](../apps/web/Dockerfile) — drop unused Prisma generate for web

### NestJS API

- [`apps/api/src/main.ts`](../apps/api/src/main.ts) — SIGTERM/SIGINT graceful shutdown; strict-safe request IDs
- [`apps/api/src/health/health.controller.ts`](../apps/api/src/health/health.controller.ts) — Redis **PING** (not TCP-only)
- [`apps/api/src/app.module.ts`](../apps/api/src/app.module.ts) — `APP_GUARD` via `useExisting`
- [`apps/api/src/auth/auth.module.ts`](../apps/api/src/auth/auth.module.ts) — single guard registration; removed RolesGuard
- Deleted [`apps/api/src/common/guards/roles.guard.ts`](../apps/api/src/common/guards/roles.guard.ts)
- [`apps/api/src/common/decorators/require-permission.decorator.ts`](../apps/api/src/common/decorators/require-permission.decorator.ts) — removed unused `RequireRoles`
- [`apps/api/src/common/guards/clerk-auth.guard.ts`](../apps/api/src/common/guards/clerk-auth.guard.ts) — `ALLOW_DEV_AUTH` gate for `x-dev-clerk-user-id`
- [`apps/api/src/config/env.validation.ts`](../apps/api/src/config/env.validation.ts) — `ALLOW_DEV_AUTH`; removed unused JWT_* fields
- [`apps/api/tsconfig.json`](../apps/api/tsconfig.json) — full `strict` + `noUncheckedIndexedAccess`
- [`apps/api/src/command-center/command-center.repository.ts`](../apps/api/src/command-center/command-center.repository.ts) — strict month parsing
- [`apps/api/src/qc/qc.repository.ts`](../apps/api/src/qc/qc.repository.ts) — strict month parsing + co-owner name typing

### Next.js / Clerk

- [`apps/web/package.json`](../apps/web/package.json) — removed unused `@workspace/database`; pinned `@next/env` to `16.2.6`; ESLint 9
- [`apps/web/next.config.ts`](../apps/web/next.config.ts) — transpilePackages cleanup; webpack-dev note
- [`apps/web/hooks/use-api.ts`](../apps/web/hooks/use-api.ts) — `"use client"`
- [`apps/web/stores/app-store.ts`](../apps/web/stores/app-store.ts) — `"use client"`

### Packages / env

- [`packages/ui/package.json`](../packages/ui/package.json), [`packages/jobs/package.json`](../packages/jobs/package.json), [`packages/excel-reports/package.json`](../packages/excel-reports/package.json), [`packages/eslint-config/package.json`](../packages/eslint-config/package.json), [`apps/worker/package.json`](../apps/worker/package.json) — ESLint 9 alignment
- [`.env.example`](../.env.example), [`.env.development.example`](../.env.development.example), [`.env.production.example`](../.env.production.example) — `ALLOW_DEV_AUTH`; removed JWT_*

---

## 2. Bugs found

| Bug                                                                                                  | Severity           |
| ---------------------------------------------------------------------------------------------------- | ------------------ |
| Jest CI invoked with `--runInBand` via fragile pnpm `--` forwarding (flags can become test patterns) | High               |
| No root `pnpm test` / Turbo `test` task                                                              | High               |
| CI set `REDIS_URL` but never started Redis                                                           | High               |
| `apps/worker/Dockerfile` was a stub that exits 1 while worker app exists                             | Critical (release) |
| API `/ready` only TCP-connected to Redis (false positives)                                           | Medium             |
| Duplicate Nest guard instances (`useClass` APP_GUARD + AuthModule providers)                         | Medium             |
| Dead `RolesGuard` / `@RequireRoles` never wired                                                      | Low                |
| API TypeScript not fully strict (`noImplicitAny: false`)                                             | Medium             |
| ESLint major mismatch (9 vs 10) causing peer warnings                                                | Medium             |
| Unused `@workspace/database` in web                                                                  | Low                |
| Client-only modules missing `"use client"`                                                           | Medium             |
| `x-dev-clerk-user-id` allowed whenever Clerk secret unset (non-prod)                                 | Medium             |
| Unused `turbo-cli` root dependency                                                                   | Low                |
| Unused `JWT_AUDIENCE` / `JWT_ISSUER` env fields                                                      | Low                |
| Unused `uuid` / `@types/uuid` in API                                                                 | Low                |

---

## 3–5. Root causes, fixes, and why they work

### Jest `--runInBand` treated as a test pattern

**Root cause:** Jest treats positional CLI tokens as test-name/path patterns. When `--runInBand` is not received as a flag (broken binary path historically, or fragile `pnpm … test -- --runInBand` forwarding), Jest searches for tests named `runInBand` and exits 1.

**Fix:** Bake flags into `"test:ci": "node ./scripts/run-jest.mjs --runInBand --ci --passWithNoTests"` and call `pnpm --filter api test:ci` from CI with **no** `--` forwarding.

**Why it works:** Flags are part of the package script argv always passed to Jest via `run-jest.mjs`, independent of pnpm/CI quoting.

### Missing Redis in CI

**Root cause:** Job env advertised Redis but no `services.redis`.

**Fix:** Added `redis:7-alpine` with healthcheck on port 6379.

**Why it works:** Matches `REDIS_URL=redis://localhost:6379` used by API/worker and readiness checks.

### Worker Docker stub

**Root cause:** Dockerfile never updated after `apps/worker` was implemented; release/compose published a crash-loop image.

**Fix:** Multi-stage build mirroring API (`pnpm install` → `db:generate` → `turbo build --filter=worker...` → `node dist/main.js`).

**Why it works:** Produces the same Nest ESM artifact as local `pnpm --filter worker build`.

### Redis readiness false positives

**Root cause:** Health used raw TCP `connect`, which succeeds if any process listens, not if Redis responds to PING.

**Fix:** Short-lived `ioredis` client with `PING === PONG`.

**Why it works:** Validates Redis protocol, same as worker health.

### Auth guard duplication / dead RolesGuard

**Root cause:** Guards registered twice (`AuthModule` + `APP_GUARD useClass`); role decorator never used (permission RBAC is the real model).

**Fix:** `APP_GUARD` uses `useExisting`; remove RolesGuard/RequireRoles.

**Why it works:** One DI instance per guard; authorization remains `@RequirePermission` + Nest DB RBAC.

### Dev auth bypass

**Root cause:** Any non-production process without `CLERK_SECRET_KEY` accepted `x-dev-clerk-user-id`.

**Fix:** Require `ALLOW_DEV_AUTH=true` **and** non-production.

**Why it works:** Explicit opt-in; production still requires Clerk keys via env validation.

### API TypeScript strictness

**Root cause:** Partial strict settings hid undefined/indexed-access bugs.

**Fix:** Enable `strict` + `noUncheckedIndexedAccess`; fix month parsing, request ID, co-owner DTO typing.

**Why it works:** Compile-time guarantees match worker/packages already on full strict.

---

## 6. Remaining technical debt

- Prisma PKs use **CUID**, not UUID (intentional; documented — do not migrate without a data plan).
- Web app is mostly client-fetched (axios + React Query); limited RSC data loading.
- E2E coverage is minimal (`app.e2e-spec.ts` health-only); worker has no unit tests.
- `eslint-plugin-only-warn` still converts some frontend lint issues to warnings (API Nest ESLint treats prettier/unused as errors).
- Transitive npm deprecations (`glob@7`, `fstream`, etc.) from ExcelJS/legacy deps.
- Turbo `lint`/`typecheck` still depend on `^build` (slow but safe for Prisma client ordering).
- Local `.env.development` may still contain legacy `JWT_*` keys (harmless; examples updated).

---

## 7. Performance improvements

- Removed unused `@workspace/database` from web dependency graph / transpile list.
- Removed unused `uuid` from API bundle surface.
- Worker image now builds only needed workspace graph (`worker...`) instead of shipping a stub.
- Redis readiness no longer under-reports failures (avoids serving traffic against a dead queue).

---

## 8. Security improvements

- `ALLOW_DEV_AUTH` explicit gate for header-based Clerk bypass.
- Removed unused JWT audience/issuer knobs that suggested Nest JWT auth (auth is Clerk `verifyToken`).
- Helmet, throttling, CORS, Clerk verification, and `@Public()` health endpoints retained.
- Production env validation still requires Clerk keys.
- Worker/API run as non-root in Docker.

---

## 9. CI improvements

| Before                                       | After                       |
| -------------------------------------------- | --------------------------- |
| `pnpm --filter api test -- --runInBand --ci` | `pnpm --filter api test:ci` |
| No Redis service                             | Redis 7 with healthcheck    |
| Node `22` (loose)                            | Node `22.12`                |
| No worker image build                        | Builds worker Dockerfile    |
| No root/turbo test                           | `pnpm test` → `turbo test`  |

---

## 10. Production readiness checklist

- [x] `pnpm install` succeeds
- [x] `pnpm lint` succeeds (0 errors)
- [x] `pnpm typecheck` succeeds
- [x] `pnpm build` succeeds (api, web, worker, packages)
- [x] `pnpm test` succeeds (13 suites / 54 tests)
- [x] `pnpm --filter api test:ci` succeeds
- [x] `pnpm verify:dev` succeeds (6/6)
- [x] `pnpm dev` script is wired (`turbo dev` for api/web/worker); local smoke hit `EADDRINUSE` on :3000 (existing process) — free the port or stop the prior Next server before re-running
- [x] Worker Dockerfile is a real production image
- [x] CI workflow includes Postgres + Redis + Prisma + tests + Docker builds
- [x] Clerk session: `proxy.ts` + `auth.protect()`; Nest RBAC remains permission-based
- [x] Graceful shutdown on API and worker
- [x] `/ready` uses Redis PING
- [ ] Push branch and confirm GitHub Actions green on remote

**Note on remaining non-fatal warnings:** `pnpm install` still reports transitive deprecations (`fstream`, `glob@7`, etc. via ExcelJS). Jest ESM prints Node `ExperimentalWarning: VM Modules`. Neither fails the command.
---

## Validation commands run locally

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm --filter api test:ci
pnpm verify:dev
```

All completed with exit code 0.
