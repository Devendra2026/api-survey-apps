# Convex → NestJS ETL Runbook

## Overview

Live sync from self-hosted Convex (source of truth until cut-over) into NestJS Postgres + MinIO/S3.

- Identity: Convex `surveys._id` → `Survey.legacySurveyId` (dedupe **only** on this field)
- Photos: `front` | `inside` | `side` | `document`
- Object keys: `etah-images/district-{code}/ward-{wardNo}/{legacySurveyId}/{slot}.{ext}`

## Prerequisites

1. Postgres migrated (`pnpm --filter @workspace/database db:deploy`)
2. Redis + MinIO (or S3) running
3. Geo catalog (districts/ULBs/wards) and at least one Nest user seeded
4. Convex env: `ETL_SECRET=<shared-secret>`
5. Nest/Worker env:

```env
ETL_ENABLED=true
CONVEX_SITE_URL=https://<your-convex-site>
ETL_CONVEX_SECRET=<same-as-ETL_SECRET>
ETL_BATCH_SIZE=100
ETL_CRON=*/15 * * * *
ETL_SYSTEM_USER_ID=<optional nest user uuid>
ETL_MAX_RETRIES=5
ETL_STALE_JOB_TIMEOUT_MINUTES=60
STORAGE_PROVIDER=minio   # or s3
```

6. Admin role has `etl:manage` permission (seeded)

## UI (production)

With `etl:manage` and Convex env configured on api + worker:

1. **Master Data → Tenants & Wards** — **Sync from Convex** runs `POST /etl/incremental-sync` (safe default). Status badge polls while a job is active. Link **ETL console** opens the full page.
2. **Administration → ETL Sync** (`/admin/etl`) — Incremental, Full (confirm), Retry failed, Validate, job history, and report drill-down.

CLI below remains available for ops/scripts.

## Local run command

With Docker (Postgres/Redis/MinIO) up and `pnpm dev` (api + worker):

```bash
# Enable ETL in .env.development first:
# ETL_ENABLED=true
# CONVEX_SITE_URL=https://….convex.site
# ETL_CONVEX_SECRET=<same as Convex ETL_SECRET>

pnpm etl:run full --batch-size 20 --watch
pnpm etl:run incremental
pnpm etl:run status
pnpm etl:run report --job-id <id>
pnpm etl:run validate
```

Auth: uses `ETL_DEV_CLERK_USER_ID` or first `BOOTSTRAP_ADMIN_CLERK_USER_IDS` as `Bearer dev:<id>` when `ALLOW_DEV_AUTH=true`.

## APIs

| Method | Path                    | Purpose                        |
| ------ | ----------------------- | ------------------------------ |
| POST   | `/etl/full-migration`   | Import all surveys             |
| POST   | `/etl/incremental-sync` | Import missing only            |
| POST   | `/etl/retry-failed`     | Retry `failed_imports`         |
| POST   | `/etl/validate`         | Count/URL validation           |
| POST   | `/etl/reap-stale`       | Close abandoned QUEUED/RUNNING |
| GET    | `/etl/preflight`        | Diagnose Convex URL + secret   |
| GET    | `/etl/status`           | Active job + counters          |
| GET    | `/etl/report?jobId=`    | Job stats                      |
| GET    | `/etl/jobs`             | Recent jobs                    |

## Shared secret

The worker sends `X-ETL-Secret`; Convex compares it to its own `ETL_SECRET`. Both
sides trim the value, because a secret pasted or piped into an environment variable
usually picks up a trailing newline that is invisible in every dashboard.

Set the same value on both sides:

```bash
# Convex (from sdv-monorepo-apps/packages/backend)
npx convex env set ETL_SECRET '<value>'

# Nest api + worker (Dokploy env, quoted — avoid # and quotes inside the value)
ETL_CONVEX_SECRET='<value>'
```

Verify without revealing it — both sides print the same 12-hex fingerprint:

```bash
pnpm etl:run preflight
```

`secretFingerprint` is what the worker sends; `secretFingerprintSeenByConvex` is
what Convex received. Equal fingerprints with a 401 means Convex holds a different
value; unequal means the header was altered in transit.

## Troubleshooting

### ETL jobs fail with 401 Unauthorized

Run `pnpm etl:run preflight` (or `GET /etl/preflight`) and read `convex.reason`:

| `reason`                          | Meaning                                  | Fix                                                       |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| `secret_mismatch`                 | Convex holds a different `ETL_SECRET`    | Re-set both sides from one value, then redeploy worker    |
| `secret_missing`                  | Convex received no header                | Check the proxy in front of `CONVEX_SITE_URL` forwards it |
| `secret_not_configured`           | Convex has no `ETL_SECRET` (returns 500) | `npx convex env set ETL_SECRET '<value>'`                 |
| absent, `answeredByConvex: false` | A proxy answered, not Convex             | Inspect ingress/Traefik rules for `CONVEX_SITE_URL`       |

A 404 instead means the ETL endpoints are not deployed — run `npx convex deploy`
in `sdv-monorepo-apps/packages/backend`.

Auth failures are permanent: the queue stops after one attempt instead of burning
its retry budget, and the owning `migration_jobs` row is marked `FAILED` immediately
with the remediation stored in `statsJson.remediation`.

### Jobs stuck in RUNNING / "Full migration already running"

Rows are closed automatically when the api starts and before each full migration.
To sweep on demand:

```bash
pnpm etl:run reap-stale
```

A job is abandoned when it has made no progress for `ETL_STALE_JOB_TIMEOUT_MINUTES`
(default 60); every batch advances `updatedAt`, so a quiet row means the worker died
or was redeployed mid-run. `force=true` on a full migration still bypasses the check.

## Dry-run checklist

1. Point `CONVEX_SITE_URL` at staging Convex
2. `POST /etl/full-migration` with small batch
3. Spot-check survey + photos in dashboard (presigned MinIO/S3 URLs)
4. `POST /etl/validate`
5. Crash worker mid-batch → restart → confirm resume via `migration_state` / job cursor

## Rollback

1. Set `ETL_ENABLED=false` and stop cron/queues
2. Soft-delete ETL surveys: `legacySurveyId IS NOT NULL` in the job window (`deletedAt`)
3. Enqueue storage cleanup for `etah-images/...` keys
4. Leave Convex authoritative

## Cut-over checklist

1. Deploy mobile app writing to Nest (or freeze Convex writes)
2. Final `POST /etl/incremental-sync`
3. `POST /etl/validate` — survey/image counts; no display paths depending on Convex URLs
4. QC approval sample
5. `ETL_ENABLED=false`
6. Archive Convex DB + storage backup
7. Decommission Convex

## Architecture packages

- `@workspace/etl-core` — pure transform/validation/keys
- `apps/api/src/etl` — control plane
- `apps/worker/src/etl` — BullMQ processors + transactional load
- `sdv-monorepo-apps/.../convex/etl` — extract HTTP + internal queries
