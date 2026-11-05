# Fixes Changelog

Audit date: 2026-11-06. IDs (S#) refer to SECURITY_AUDIT.md.

## apps/api

| File                                               | Issue                                              | Root cause                                                                                                     | Change                                                                                                              | Verification                                                              |
| -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/common/utils/tenant-scope.util.ts`            | S1 cross-tenant rows on search / export            | Tenant filter returned as top-level `OR`; callers spread it before their own `OR`/`id` keys, which replaced it | Return `{ AND: [{ OR }] }` / `{ AND: [{ id: "__no_access__" }] }`                                                   | Updated expectations + new regression test in `tenant-scope.util.spec.ts` |
| `src/storage/public-storage.controller.ts`         | S2 unauthenticated download of import/export files | Key check accepted any key containing `/`                                                                      | New `isPublicImageKey`: image extension required, `imports/`/`exports/` refused                                     | New `public-storage.controller.spec.ts`                                   |
| `src/demand-notices/demand-notices.service.ts`     | S3 print token opens any survey/ward               | Claim checks skipped when the claim was absent; mint did no tenant check                                       | Strict claim equality (+ assessment year), mint is async and validates survey/ward access                           | New `print-token-scope.spec.ts` (5 cases)                                 |
| `src/common/utils/ward-scope.util.ts` (new)        | Shared ward-in-scope check                         | —                                                                                                              | `assertWardInUserScope(db, user, wardId)` resolves ward → ULB → district → state and applies `canAccessTenant`      | Covered by print-token spec                                               |
| `src/reports/reports.service.ts`                   | S4 ward PDF export for foreign wards               | No scope check before enqueue; worker reads via token route                                                    | `assertWardInUserScope` before creating the job                                                                     | Typecheck + existing report specs                                         |
| `src/users/users.service.ts`                       | S5 scoped manager can disable/delete global admins | "Pending" detected by missing geo; update/delete reused visibility                                             | `isUnaffiliatedOrPending` uses role name; new `canManageUser` (every active role in scope) on `update` and `remove` | 4 new cases in `users.service.remove.spec.ts`                             |
| `src/common/services/role-provisioning.service.ts` | S6 portal user can become first ADMIN              | First-sign-in rule ignored which Clerk instance verified the session                                           | `ensureBootstrapAdmin(..., { allowFirstSignInAdmin })`                                                              | New case in `role-provisioning.service.spec.ts`                           |
| `src/common/guards/clerk-auth.guard.ts`            | S6                                                 | —                                                                                                              | Passes the matched Clerk instance; portal → `allowFirstSignInAdmin: false`                                          | Existing guard specs                                                      |
| `src/main.ts`                                      | Misleading boot warning                            | Message contradicted behaviour                                                                                 | Text now describes the first-sign-in rule                                                                           | —                                                                         |
| `src/health/health.controller.ts`                  | Redis connection churn on `/ready`                 | New client per call                                                                                            | Single lazy probe client, closed in `onModuleDestroy`                                                               | Typecheck                                                                 |

## apps/worker

| File                         | Issue                                                    | Change                        | Verification                         |
| ---------------------------- | -------------------------------------------------------- | ----------------------------- | ------------------------------------ |
| `src/tenant/tenant-scope.ts` | S1 in async exports (search `OR` replaced tenant filter) | Same `AND` nesting as the API | Typecheck (worker has no unit tests) |

## apps/web

| File                                                              | Issue                                                                        | Change                                                   | Verification |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ------------ |
| `lib/survey-registry-xlsx.ts`, `app/(dashboard)/surveys/page.tsx` | S7 vulnerable `XLSX.read` + main-thread parse; upload blocked if parse threw | Removed client parse; toast uses server message          | Typecheck    |
| `app/api/maps-health/route.ts`                                    | S8 outbound request per call                                                 | Memoised result with TTLs, in-flight dedupe, 5 s timeout | Typecheck    |

## apps/mobile

| File                                               | Issue                                                                                                  | Change                                                                    | Verification                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------ |
| `src/features/surveys/screens/NewSurveyScreen.tsx` | Duplicate draft surveys after a timed-out create                                                       | Stable temp property ID per ULB/ward/year; on 409 load the existing draft | Typecheck; not run on device   |
| `src/features/surveys/lib/owner-mapping.ts`        | Returned caller's readonly array (aliasing) — also a pre-existing TS4104 error that failed `typecheck` | Always return a copy                                                      | Typecheck clean; 168/168 tests |

## Dependencies (branch `chore/security-dependency-upgrades`)

| File                                                      | Change                                                                          | Verification                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/web/package.json`                                   | `next`/`@next/env` 16.4.5, `axios` ^1.21.0, removed unused `@aws-sdk/client-s3` | `next build` succeeds (31 pages), typecheck, lint                               |
| `apps/api/package.json`                                   | `multer` ^2.5.0, `compression` ^1.8.2                                           | 528 API tests incl. new upload smoke test                                       |
| `apps/worker/package.json`                                | `playwright` 1.55.1                                                             | typecheck + `nest build`; PDF render **not** run (no browser installed locally) |
| `packages/eslint-config/package.json`                     | `@next/eslint-plugin-next` ^16.4.5                                              | web lint                                                                        |
| `pnpm-workspace.yaml`                                     | overrides `multer: ^2.5.0`, `compression: ^1.8.2`                               | `pnpm why` shows single patched versions                                        |
| `pnpm-lock.yaml`                                          | regenerated; 47 versions changed, no new majors                                 | `pnpm install --frozen-lockfile`                                                |
| `apps/api/src/common/upload-pipeline.smoke.spec.ts` (new) | Real `FileInterceptor` + memory storage: parses file, 413 over limit            | 2/2 pass                                                                        |

## Not changed (see reports)

Remaining audit items (`zod`, `follow-redirects`, tooling-only advisories), `/metrics` exposure, public photo links, `pg_trgm` indexes, survey PATCH concurrency control, dev compose bucket policy, tracked `.claude-flow/` / `.swarm/` state.
