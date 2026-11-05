# Codebase Audit Report

Date: 2026-11-06 · Branch: `main` (uncommitted changes) · Companion reports: SECURITY_AUDIT.md, PERFORMANCE_AUDIT.md, DEPENDENCY_AUDIT.md, DATA_SYNC_AUDIT.md, FIXES_CHANGELOG.md.

## 1. Architecture

pnpm 12 + Turborepo 2 monorepo for a municipal property-tax survey platform (Etah / UP ULBs).

| Workspace                        | Role                                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                       | NestJS 11 REST API. Global guards: throttler → Clerk JWT → permissions → tenant geo. Prisma 7 on PostgreSQL, BullMQ producer, S3/MinIO storage, Svix-verified Clerk webhook, ULB API-key portal routes. ~45 modules. |
| `apps/worker`                    | NestJS BullMQ consumers: imports, exports (xlsx/pdf/zip, Playwright for demand-notice PDFs), Convex→Postgres ETL, image migration, storage cleanup.                                                                  |
| `apps/web`                       | Next.js 16 App Router admin dashboard. Clerk via `proxy.ts`; server-side `auth.protect()` + `/users/me` gate in `(dashboard)/layout.tsx`. TanStack Query.                                                            |
| `apps/mobile`                    | Expo SDK 57 / RN 0.86 surveyor app, Expo Router, Clerk Expo, TanStack Query.                                                                                                                                         |
| `packages/database`              | Prisma schema (34 migrations), client factory with pg adapter + pool settings, seeds.                                                                                                                                |
| `packages/validation`            | Shared zod schemas/enums for web, mobile, api, worker.                                                                                                                                                               |
| `packages/etl-core`, `audit-etl` | Pure-TS ETL domain for Convex migration.                                                                                                                                                                             |
| `packages/excel-reports`         | Workbook renderers shared by api (sync) and worker (async).                                                                                                                                                          |
| `packages/jobs`                  | Queue names + payload types.                                                                                                                                                                                         |
| `packages/ui`                    | shadcn/radix components for web.                                                                                                                                                                                     |

Infra: `docker-compose.yml` (local Postgres 17, Redis 8, MinIO, Mailpit), `docker-compose.dokploy.yml` (prod: Traefik, migrate job, api, worker, web, private MinIO), Swarm stack, GitHub Actions CI (frozen-lockfile install, typecheck, build, tests).

Clerk: two instances — admin (web + mobile) and portal (portal.nppetah.in). Both verified by the API; users share one `User` table keyed by `clerkUserId`.

## 2. Method

1. Read every manifest, turbo/CI/compose config, env validation.
2. Traced the request path (guards, tenant scoping) and every `@Public()` route.
3. Grepped every `buildTenantWhere` call site for key collisions; every storage write for key prefixes.
4. Reviewed worker queue options, Playwright lifecycle, shutdown.
5. Reviewed web auth gate, polling, client-side parsing; mobile API client, query config, create flow.
6. `pnpm audit --prod`.
7. Fixed confirmed issues with tests; re-ran typecheck/tests/lint.

Baseline before changes: API `tsc` clean, **81 suites / 512 tests passing**.

## 3. Issues found

| ID  | Severity | Area                                                                                                 | Status                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| S1  | Critical | Tenant filter overridden by search / selection (API + worker export)                                 | Fixed                        |
| S2  | Critical | Public storage proxy served import/export files                                                      | Fixed                        |
| D1  | Critical | `next@16.2.6` unauthenticated RCE advisories                                                         | Fixed on branch (16.4.5)     |
| S3  | High     | Print tokens not bound to survey/ward; mint without tenant check                                     | Fixed                        |
| S4  | High     | Ward PDF export without scope check                                                                  | Fixed                        |
| S5  | High     | Scoped managers could disable/delete global admins                                                   | Fixed                        |
| S6  | High     | Portal sign-ups eligible for first-sign-in ADMIN                                                     | Fixed                        |
| D2  | High     | multer / compression / body-parser / proxy-addr advisories (API)                                     | Fixed on branch              |
| M1  | Medium   | Mobile create retry produced duplicate draft surveys                                                 | Fixed                        |
| M2  | Medium   | Mobile `mergeCoOwners` aliasing + failing typecheck                                                  | Fixed                        |
| S7  | Medium   | Vulnerable `XLSX.read` on user files (web)                                                           | Fixed (parse removed)        |
| P1  | Medium   | `/ready` opened a Redis connection per call                                                          | Fixed                        |
| S9  | Medium   | `/metrics` publicly routed                                                                           | Open — infra decision        |
| S10 | Medium   | Guessable public photo URLs (by design)                                                              | Open — product decision      |
| P2  | Low      | Text search without trigram indexes                                                                  | Open — migration recommended |
| S8  | Low      | `/api/maps-health` outbound call per request                                                         | Fixed                        |
| R1  | Low      | Agent-tooling state (`.claude-flow/`, `.swarm/`) tracked in git; `tmp-clerk-fingerprint.mjs` at root | Open — housekeeping          |
| R2  | Low      | Unused `@aws-sdk/client-s3` in web                                                                   | Fixed on branch              |

## 4. Module notes

- **Auth/RBAC**: Well structured. JWT verification, azp handling for native tokens, verified-email rebinding, identity invariant, disabled-user checks are correct. Issues were in _authorization helpers_ (S1, S5) and bootstrap policy (S6), not in token handling.
- **Tenant scoping**: `canAccessTenant` correctly prevents parent ULB/district from widening an explicit ward allotment. The bug was purely in how the Prisma filter object was composed.
- **Storage**: Photo keys are random UUIDs under `uploads/…`; upload validates magic bytes; compensating deletes on failure. The public proxy is intentional for Excel links; now limited to images.
- **Worker**: Bounded concurrency, retries with backoff, bounded job retention, graceful shutdown, Playwright closed in `finally`. Its tenant helper is a copy of the API's — consider moving it into a shared package so the two cannot drift again.
- **Web**: Server-side gate on every dashboard request; polling only while jobs are active.
- **Mobile**: Robust API client (timeouts, typed errors, no 4xx retries, user-scoped cache).
- **Database**: Sensible pool and timeouts, partial unique indexes for active survey identity, composite indexes for list filters.

## 5. Verification

| Check                                   | Before                                       | After                                                                |
| --------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm turbo typecheck` (all workspaces) | mobile failed (TS4104 in `owner-mapping.ts`) | **18/18 tasks pass**                                                 |
| API Jest (`test:ci`)                    | 81 suites / 512 tests pass                   | **83 suites / 526 tests pass** (14 new tests)                        |
| Mobile `node --test`                    | 168 pass                                     | **168 pass**                                                         |
| `pnpm --filter api lint`                | —                                            | clean                                                                |
| `pnpm --filter worker lint`             | —                                            | clean                                                                |
| Web eslint on touched files             | —                                            | 0 errors (3 pre-existing react-hooks warnings in `surveys/page.tsx`) |
| `pnpm --filter web lint` (full)         | —                                            | 0 errors, 45 pre-existing warnings                                   |
| `pnpm install --frozen-lockfile`        | —                                            | succeeds                                                             |

After the dependency upgrade batch (branch `chore/security-dependency-upgrades`):

| Check                                                        | Result                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm turbo typecheck --force`                               | 18/18                                                                       |
| `pnpm turbo build --filter=web --filter=api --filter=worker` | 10/10 tasks; Next 16.4.5 compiled, 31 pages generated                       |
| API Jest                                                     | 84 suites / 528 tests pass (adds upload-pipeline smoke test for multer 2.5) |
| Mobile tests                                                 | 168/168                                                                     |
| Lint api / worker / web                                      | 0 errors (web: 45 pre-existing warnings)                                    |
| `pnpm audit --prod`                                          | 167 → 119 advisories, critical 7 → 1 (Expo CLI tooling)                     |

## 6. Limitations

- No running stack was available: no end-to-end tests of sign-in, uploads, worker jobs, Redis, or MinIO were executed; no load/CPU/memory profiling.
- Mobile changes verified by typecheck + unit tests only, not on a device.
- `apps/worker` has no unit test suite; its change is verified by typecheck and by review.
- Web production build (`next build`) not run in this audit (typecheck only).
- Worker Playwright 1.55.1 PDF rendering not exercised locally (browser not installed); the Docker build installs it. Smoke-test a ward demand-notice PDF on staging.
