# Task 5 Report: Dashboard HTTP 403 authorization

## Status

Implemented and committed as `0e1aa70` (`fix(web): return HTTP 403 for dashboard users without permissions`).

## Changes

- Added `hasDashboardAccess` with focused coverage for absent, empty, and non-empty permissions.
- Protected the dashboard server layout with Clerk v7 `auth.protect()`, a Clerk session token, and `GET /users/me`.
- Redirected API `401` responses to sign-in and raised Next.js `forbidden()` for API `403` responses or profiles without permissions.
- Removed the client-side Pending User panel while retaining the defensive empty-permissions guard.
- Enabled Next.js `experimental.authInterrupts` so `forbidden()` returns HTTP 403.
- Documented comma-separated `BOOTSTRAP_ADMIN_CLERK_USER_IDS` in `.env.example`.

## Verification

- `node --test apps/web/lib/auth/dashboard-access.test.mjs` — passed (3 tests).
- `pnpm --filter web typecheck` — passed.
- Focused ESLint check for changed web TypeScript files — passed.
- `pnpm --filter web build` — passed after commit hooks with Next.js 16.2.6.

## Concerns

- The live Clerk/API role matrix was not exercised because this workspace has no test identities or running authenticated environment. The server behavior is covered by the access-helper tests and production build, but PENDING, bootstrap-admin, and operational-role flows still need environment-level smoke testing.
- Existing untracked SDD artifacts were left untouched and were not included in the commit.
