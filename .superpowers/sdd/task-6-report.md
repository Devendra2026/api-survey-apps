# Task 6 Report: Admin promote CLI

## Status

Implemented and committed as `a63f250` (`feat(api): add CLI to promote Clerk user to ADMIN`).

## Changes

- Added `pnpm --filter api promote-admin -- --clerk-user-id user_xxx` and root `pnpm admin:promote` entry points.
- Added a standalone CLI that requires `DATABASE_URL` or `DIRECT_URL`, reports missing users/ADMIN role, and always disconnects Prisma.
- Added shared transactional promotion helpers in `@workspace/database`.
- Updated bootstrap role provisioning to use the shared helper.
- Promotion deactivates active non-ADMIN assignments and creates an active global ADMIN assignment only when one does not already exist.
- Added an idempotence regression test covering promotion followed by a repeat promotion.
- Extended API ESLint project-service coverage to include script `.mjs` files.

## Verification

- `node --check apps/api/scripts/promote-admin.mjs` — passed.
- `pnpm --filter @workspace/database build` — passed.
- `pnpm --filter api typecheck` — passed.
- `pnpm --filter api test -- role-provisioning --runInBand` — passed (6 tests).
- `pnpm --filter api lint` — passed.
- Commit pre-commit formatting and lint checks — passed.

## Concerns

- The CLI was not run against a live database to avoid changing real user roles; database behavior is covered with mocked Prisma unit tests.
- Existing untracked SDD artifacts were left untouched and were not included in the commit.
