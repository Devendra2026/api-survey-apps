# Repository Workflow Review

Reviewed 2026-11-06. Sources: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `docker-compose.dokploy.yml`, `apps/*/Dockerfile`, `.husky/pre-commit`, `lint-staged.config.mjs`, `DEPLOYMENT.md`, GitHub API (branch protection, rulesets, environments, run history).

## End-to-end flow (as it works today)

```
 Local dev
   pnpm dev (turbo: api, web, worker, mobile) + docker-compose.yml (Postgres 17, Redis 8, MinIO, Mailpit)
        │
        ▼
 git commit ── .husky/pre-commit → lint-staged
        │        prettier --write (json/md/yml/css + app/package sources), eslint --fix per workspace
        ▼
 git push → Pull request to main
        │
        ▼
 CI (.github/workflows/ci.yml, on PR + push to main/master; contents: read)
   checkout → pnpm 12.5.1 / Node 24 assert → install --frozen-lockfile → prisma generate
   → build packages → lint → typecheck → mobile lint + typecheck
   → prisma migrate deploy (ephemeral Postgres service)
   → API tests → package tests → mobile tests          ← package/mobile added 2026-11-06
   → pnpm build → docker build api / web / worker (smoke) → docker compose config (Dokploy file)
        │
        ▼
 Merge to main   (NOT protected: no required checks, no required review)
        │
        ▼
 Release (.github/workflows/release.yml, on tag v* or manual dispatch)
   environment "production" (does not exist yet → no approval gate)
   → build api/web/worker images → push immutable tag (+ :latest for v*) to ECR via OIDC role
   → optional Dokploy webhook → optional health: API /live + /ready, web /healthz
        │
        ▼
 Deploy (Dokploy, Docker Compose, docker-compose.dokploy.yml)
   migrate service (prisma migrate deploy) → api / worker / web → Traefik ingress
   admin.sdvedutech.in → web:3000 · backend.sdvedutech.in → api:4000 · worker internal
        │
        ▼
 Monitor: container health checks (/live, /healthz), /metrics (Prometheus config in deploy/observability)
 Rollback: redeploy previous immutable image tag / commit; DB restore from backup (no migrate down)
```

Mobile releases are separate (EAS / local); not part of CI or release.

## Findings

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                          | Status                                                                                                                                                               |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | **High** | `main` has no branch protection and no rulesets. Five consecutive pushes (2026-10-05 → 10-29) landed directly on `main` with **failing CI** (mobile `TS4104` in `owner-mapping.ts`).                                                                                                                                             | **Needs repo admin.** Protect `main`: require PR, require the `Lint, test, migrate, and build` check, block force-push.                                              |
| W2  | **High** | Release does not depend on CI. A `v*` tag (or manual dispatch from any ref) builds and pushes images even if CI failed for that commit.                                                                                                                                                                                          | Recommend: require tags only from protected `main` (tag ruleset), or add a step that checks the commit's CI status via `gh api` before pushing.                      |
| W3  | **High** | GitHub environment `production` does not exist, so the release job (which holds AWS push rights) runs with no required reviewers.                                                                                                                                                                                                | **Needs repo admin:** create `production` with required reviewers and restrict to `main`/tags.                                                                       |
| W4  | Medium   | Release pushes images to ECR, but `docker-compose.dokploy.yml` has `build:` for every service with default local image names. Unless Dokploy sets `APP_IMAGE_API/WORKER/WEB` to the ECR tag, Dokploy rebuilds from source, so the deployed artefact is not the released image and "rollback to previous ECR tag" does not apply. | Confirm Dokploy configuration; then either set `APP_IMAGE_*` to ECR tags (pull, no build) or drop the ECR step. Not changed (infra not visible from repo).           |
| W5  | Medium   | CI ran only API tests; package (101 tests) and mobile (168) suites never ran.                                                                                                                                                                                                                                                    | **Fixed** (`ci: run package and mobile test suites`).                                                                                                                |
| W6  | Medium   | lint-staged formatted `pnpm-lock.yaml` with Prettier → ~18k-line diffs on every dependency change.                                                                                                                                                                                                                               | **Fixed** (`.prettierignore`).                                                                                                                                       |
| W7  | Medium   | Local agent-tooling state (`.claude-flow/`, `.swarm/`) tracked in Git → stash/branch conflicts and 21k lines of churn in PR #5.                                                                                                                                                                                                  | **Fixed** (untracked + ignored).                                                                                                                                     |
| W8  | Medium   | Third-party actions pinned to major tags (`actions/checkout@v4`, `aws-actions/*`, `docker/*`). The release job has `id-token: write` + AWS role.                                                                                                                                                                                 | Pin to full commit SHAs (Dependabot/Renovate can keep them updated).                                                                                                 |
| W9  | Low      | No dependency audit in CI.                                                                                                                                                                                                                                                                                                       | Add a scheduled (not blocking) `pnpm audit --prod` job; current baseline has 1 critical in Expo CLI tooling, so a blocking gate would fail today.                    |
| W10 | Low      | Docker smoke builds have no layer cache; worker build downloads Chromium every run (~6.5 min total CI).                                                                                                                                                                                                                          | Use `docker/build-push-action` with `cache-from/cache-to: type=gha`.                                                                                                 |
| W11 | Low      | `apps/mobile` `test` script lists test files explicitly; new `*.test.ts` files are silently skipped.                                                                                                                                                                                                                             | Switch to a glob (`node --test 'src/**/*.test.ts'`).                                                                                                                 |
| W12 | Low      | `apps/web` `test:tax-preview` exists but is not wired into turbo `test` or CI.                                                                                                                                                                                                                                                   | Rename to `test` or add a CI step.                                                                                                                                   |
| W13 | Info     | API still exposes queue-based ETL endpoints, but the worker no longer consumes ETL queues (removed 2026-11-06).                                                                                                                                                                                                                  | See final report; decide whether to remove/disable the API side.                                                                                                     |
| W14 | Medium   | All nine `docs/ops/*.md` runbooks (Dokploy setup, env, runbook, backup/restore, go-live, observability, …) were deleted in unrelated commit `830f9fe` ("fix:m2m tenant scope for ward", 2026-08-18). `README.md` and `DEPLOYMENT.md` still link to them (~20 broken links), including the documented rollback/backup procedure.  | Review and restore: `git checkout 830f9fe^ -- docs/ops/` (content is from Aug 2026; check it against current compose before committing). Not restored automatically. |

## Secrets and variables (names only)

- Release secrets: `AWS_GITHUB_ACTIONS_ROLE_ARN`, `DOKPLOY_WEBHOOK_URL` (optional), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Release variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (required); `AWS_REGION`, `ECR_REPOSITORY_PREFIX`, `HEALTHCHECK_API_URL`, `HEALTHCHECK_WEB_URL`, `RELEASE_GITHUB_ENVIRONMENT` (optional).
- CI uses only throwaway values (`pk_test_ci`, local Postgres/Redis service containers). No real secrets in CI.
- Runtime secrets live in the Dokploy Environment UI (`deploy/env/dokploy.compose.env.example` documents names).
