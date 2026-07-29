# Task 8 Report: Env docs, migration notes, CHANGELOG, and report

## Status

DONE

## Commit

- `8fe4bb8` — `docs: add production upgrade migration notes and report`

## Changes

- Documented `BOOTSTRAP_ADMIN_CLERK_USER_IDS`, Clerk server/public keys,
  `CLERK_AUTHORIZED_PARTIES`, PostgreSQL/Redis/MinIO credentials, web
  `NEXT_PUBLIC_*` rebuild behavior, and host-side `BACKUP_ROOT`.
- Replaced a concrete Clerk user ID in `deploy/env/api.env.example` with a
  non-identifying placeholder.
- Corrected go-live guidance for the Task 5 HTTP 403 behavior and documented
  the supported admin-promotion CLI recovery path.
- Added PostgreSQL-major volume safety, pre-deploy backup smoke, build-arg,
  bootstrap-admin, and admin CLI migration notes.
- Added `CHANGELOG.md` and a Tasks 1–7 issue → impact → fix report using the
  committed versions and SDD reports.

## Verification

- `pnpm exec prettier --check` for all changed Markdown files — passed.
- `git diff --check` before commit — passed.
- Commit hook `lint-staged` / Prettier — passed.
- `git show --check --stat --oneline HEAD` — passed.
- IDE diagnostics for changed documentation — no errors.

## Concerns

- Documentation-only task; no application build or test suite was rerun.
- Existing Task 5 live role-matrix smoke and Task 7 disposable restore drill
  remain operator go-live checks.
- Existing untracked SDD artifacts remain uncommitted; this report is one of
  those requested task artifacts.
