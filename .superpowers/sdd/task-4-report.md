# Task 4 Report: Clerk middleware hardening

**Status:** Complete  
**Branch:** `chore/production-upgrade-stability`  
**Date:** 2026-07-29

## Summary

Replaced bare `clerkMiddleware()` in `apps/web/proxy.ts` with explicit public-route matching and `auth.protect()` for all other matched routes.

## Changes

### `apps/web/proxy.ts`

- Added `createRouteMatcher` for public routes: `/sign-in(.*)`, `/sign-up(.*)`, `/healthz`
- Wrapped middleware handler to call `await auth.protect()` when the request is not public
- Preserved existing `config.matcher` unchanged

## Verification

| Check                      | Result        |
| -------------------------- | ------------- |
| `pnpm --filter web build`  | Exit 0 (~35s) |
| TypeScript                 | Passed        |
| Clerk deprecation warnings | None observed |
| Linter (`proxy.ts`)        | Clean         |

Build output confirms proxy (middleware) is active and routes include `/healthz`, `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`.

## Commit

```
fix(web): protect non-public routes in Clerk middleware
```

Only `apps/web/proxy.ts` staged and committed. Not pushed.

## Manual follow-up (not run)

- Sign-in flow on a protected route redirect
- Unauthenticated access to `/healthz` returns 200
- Unauthenticated access to `/dashboard` redirects to sign-in

## Concerns

- `/api/*` and `/(api|trpc)(.*)` remain in the matcher; non-public API routes now require auth at the middleware layer. Confirm API routes that must stay public (if any) are added to `isPublicRoute`.
- Dashboard layout already calls `auth.protect()`; middleware now provides a first gate before layout runs.
