# Production upgrade stability report — 2026-07-29

## Scope and result

Tasks 1–7 were completed on `chore/production-upgrade-stability` in commits
`ab1fd00`, `e34359c`, `5d473ea`, `bae0111`, `0e1aa70`, `a63f250`, and
`5702f62`. The upgrade retained current framework majors while hardening
builds, deployment, authentication, authorization, and recovery operations.

Actual manifest versions are Node 24+, pnpm 11.17.0, Turbo 2.10.7,
TypeScript 5.9.3, ESLint 9.39.5, Prettier 3.9.6, Next.js 16.2.6,
React 19.2.4, NestJS core 11.1.28, Prisma 7.9.1, Clerk Next.js 7.6.1, and
Clerk backend 3.13.1.

## Issues found and fixes

### Task 1 — toolchain and build metadata

**Issue:** Root build tools and Docker build arguments lagged compatible patch
releases, and Turbo build outputs did not exclude `.next/dev`.

**Why it mattered:** Different host/container tool versions and cached
development artifacts can make production builds non-reproducible or stale.

**Fix:** Updated Turbo to 2.10.7, TypeScript to 5.9.3, ESLint to 9.39.5,
Prettier to 3.9.6, aligned all Dockerfiles to Node 24/pnpm 11.17.0/Turbo
2.10.7, and corrected Turbo outputs. Major upgrades to TypeScript 7 and
ESLint 10 were deliberately rejected.

### Task 2 — frameworks and dependency resolution

**Issue:** Prisma and Clerk packages had compatible updates available, and
Prisma 7.9.1 introduced a transitive React type version that conflicted with
web/UI importers. Prisma generation also unnecessarily required a database
URL.

**Why it mattered:** Duplicate React `Key` definitions broke the Next build,
while requiring live database configuration for client generation reduced CI
and local build reliability.

**Fix:** Aligned Prisma CLI, Client, and PostgreSQL adapter at 7.9.1; updated
Clerk Next.js to 7.6.1, Clerk backend to 3.13.1, and NestJS Swagger to
11.4.6; overrode `@types/react` at 19.2.17; and made Prisma datasource config
conditional for generation.

Some newer patch releases were held back by pnpm's minimum-release-age
policy (including Next, React, and Clerk patches). This is intentional supply
chain policy behavior, not an unresolved compatibility defect. The final
install/build reported no blocking peer-dependency error.

### Task 3 — production Compose exposure and credentials

**Issue:** Production application ports were host-published, MinIO image pins
were stale, and the secondary Swarm Redis configuration did not enforce the
same authentication as Dokploy Compose.

**Why it mattered:** Direct port exposure bypassed Traefik controls,
non-deployable/stale image pins threatened rollout reliability, and
inconsistent Redis authentication created environment drift.

**Fix:** Removed host mappings for API, worker, and web; retained Traefik-only
ingress; selected verified Docker Hub MinIO server/client releases; required
Redis authentication in Swarm; and preserved the migration success gate.

### Task 4 — Clerk route protection

**Issue:** The web proxy used bare `clerkMiddleware()` without explicitly
protecting non-public routes.

**Why it mattered:** Matching middleware alone does not express the required
authentication boundary, so routes could rely solely on downstream checks.

**Fix:** Declared sign-in, sign-up, and `/healthz` as public and applied
`await auth.protect()` to every other matched route. Routes under `/api/*`
are consequently protected unless explicitly added to the public matcher.

### Task 5 — dashboard authorization semantics

**Issue:** Authenticated users with no permissions were handled by a client
"Pending User" panel instead of an HTTP authorization response.

**Why it mattered:** A UI soft-gate is not a server authorization boundary and
produced ambiguous behavior for clients, caches, and operators.

**Fix:** The server layout now validates the Clerk session and `/users/me`,
redirects API 401 responses to sign-in, and returns Next.js HTTP 403 for API
403 or an empty permission set. `experimental.authInterrupts` is enabled and
the Pending User panel was removed.

The live PENDING/bootstrap/operational-role matrix still needs a production
smoke test because no live test identities were available during implementation.

### Task 6 — first-admin recovery

**Issue:** Recovering from missed bootstrap configuration required ad hoc
database changes; bootstrap and manual promotion could also drift in behavior.

**Why it mattered:** Editing role tables is error-prone and unauditable, and
duplicate or conflicting role assignments can produce incorrect access.

**Fix:** Added the supported `pnpm admin:promote` CLI and shared transactional,
idempotent promotion helpers. Promotion deactivates active non-admin roles and
creates one active global ADMIN assignment only when needed.

The CLI was unit-tested but intentionally not run against a live database.

### Task 7 — backups and restore safety

**Issue:** There was no complete, consistent operator workflow for backing up
and restoring PostgreSQL, Redis, and MinIO.

**Why it mattered:** A database-only backup cannot recover queue/cache state
or stored survey media, and unguarded restore commands can destroy production
data.

**Fix:** Added UTC-dated component and aggregate scripts rooted at
`${BACKUP_ROOT:-/backups}`, off-host copy commands, and restore scripts gated
by `CONFIRM=yes`. Redis restore requires a stopped, explicit data volume and
preserves prior RDB/AOF files; MinIO restore does not delete unrelated objects.

Shell syntax and guard behavior passed. ShellCheck was unavailable, and a
disposable-target restore drill remains an operator go-live requirement.

## Verification summary

- Full dependency task gate passed: Prisma generation, 9/9 build tasks,
  15/15 typecheck tasks, 12/12 lint tasks, and 8/8 test tasks.
- API tests included 29 suites/126 tests; ETL core included 2 suites/12 tests.
- Web production build and focused dashboard access tests passed.
- Compose validation passed for Dokploy, local, and Swarm files; required
  secret omission failed closed as designed.
- Backup/restore Bash syntax, required-variable checks, and confirmation
  guards passed.

## Go-live concerns

Before production sign-in, set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` and rebuild
the web image with the final `NEXT_PUBLIC_*` values. Treat any PostgreSQL
major-volume transition as a dump/restore or planned `pg_upgrade`, run a full
backup smoke, copy it off-host, and complete a disposable restore drill.

## Final validation gate (Task 9)

Validated locally on 2026-07-29 from `chore/production-upgrade-stability`:

- `pnpm install` - PASS (lockfile already current; pnpm 11.17.0).
- `pnpm turbo build` - PASS (9/9 tasks).
- `pnpm turbo lint` - PASS (12/12 tasks; 26 existing web warnings, 0 errors).
- `pnpm turbo typecheck` - PASS (15/15 tasks).
- `pnpm turbo test` - PASS (8/8 tasks; API 29 suites/127 tests and ETL core 2 suites/12 tests).
- `docker build -f apps/api/Dockerfile .` - PASS after starting the initially unavailable local Docker Desktop daemon.
- `docker build -f apps/web/Dockerfile .` - PASS without additional build arguments.
- `docker build -f apps/worker/Dockerfile .` - PASS.
- `docker compose -f docker-compose.dokploy.yml config` - PASS with dummy values for required deployment variables.

No upgrade-scoped implementation failures were found, so no fix-forward code changes were required. Remaining go-live concerns are the existing web lint warnings, final production secrets and public build-time values, and the previously documented live authorization and restore drills.
