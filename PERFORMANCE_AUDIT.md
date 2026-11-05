# Performance Audit

Date: 2026-11-06. **No load test or profiler run was executed in this audit** (no running stack / production metrics were available). Findings come from code inspection; no before/after measurements are claimed.

## API (NestJS)

| Item                  | Finding                                                                                                                                                                                                                                                                                                                                              | Action                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-request auth cost | JWT verified locally (JWKS cached by `@clerk/backend`) twice per request — once in the throttler (to key by user) and once in `ClerkAuthGuard`. Then: 1 user lookup, ≤1 pending-role lookup, 1 roles+permissions query. Clerk `getUser` and `lastLoginAt` write are throttled to once per 60 s per user. "Signed-in admin exists" check cached 60 s. | No change. Possible improvement: cache the verified `sub` on the request in the throttler and reuse in the guard (saves one signature verify, ~sub-ms). |
| `/ready` probe        | Opened and closed a new Redis TCP connection on every call; route is public and unthrottled.                                                                                                                                                                                                                                                         | **Fixed**: one lazily created probe connection, closed on shutdown.                                                                                     |
| DB pool               | `max: 10` per service, 5 s acquire timeout, 30 s statement/query timeout, 20 s idle-in-transaction timeout. API + worker = 20 of Postgres' 100.                                                                                                                                                                                                      | OK.                                                                                                                                                     |
| Indexes               | Composite indexes on `(wardId                                                                                                                                                                                                                                                                                                                        | ulbId                                                                                                                                                   | districtId | stateId, surveyStatus | qcStatus)`, `(createdById, createdAt)`, `(assignedToId, surveyStatus)`, etc. match the list filters. | OK. |
| Text search           | `contains` + `mode: insensitive` on `propertyId`, `respondentName`, `parcelNumber` cannot use btree indexes → sequential scan within the tenant-filtered set.                                                                                                                                                                                        | Recommend a migration adding `pg_trgm` GIN indexes on these columns once survey volume grows. Not applied (schema change needs approval).               |
| Sync exports          | Capped at 500 rows / 2 MB; larger exports go to the worker.                                                                                                                                                                                                                                                                                          | OK.                                                                                                                                                     |
| Uploads               | Memory storage limited to 5 MB per file.                                                                                                                                                                                                                                                                                                             | OK.                                                                                                                                                     |
| Logging               | `pino-http` plus a `LoggingInterceptor` both log each request.                                                                                                                                                                                                                                                                                       | Minor duplication; consider dropping one. Not changed.                                                                                                  |

## Worker

| Item           | Finding                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrency    | Explicit per queue: audit ETL 1, exports 2, imports 2, image migration 5, storage cleanup 5. Bounded.                                    |
| Retries        | Exponential backoff, bounded attempts (3–5). Non-retryable ETL config errors short-circuit.                                              |
| Queue memory   | `removeOnComplete` (true or 1000) and `removeOnFail` (≤5000) on every queue → Redis memory bounded.                                      |
| Playwright PDF | Browser launched per ward PDF job and closed in `finally` — no leak; ~200 MB RSS per concurrent render, capped by exports concurrency 2. |
| Polling        | None in the worker; BullMQ is event-driven (blocking `BRPOPLPUSH`/streams).                                                              |
| Shutdown       | `enableShutdownHooks` + single-flight SIGTERM/SIGINT handler.                                                                            |

## Web (Next.js)

| Item               | Finding                                                                                     | Action                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Excel import       | Parsed the whole workbook on the main thread only to count rows → UI freeze on large files. | **Fixed**: removed.                                                                      |
| `/api/maps-health` | One outbound Google request per map mount.                                                  | **Fixed**: memoised 10 min (1 min on failure), concurrent misses collapsed, 5 s timeout. |
| Polling            | Only while an import/ETL job is active (2 s), otherwise off.                                | OK.                                                                                      |
| Query defaults     | `staleTime` 30 s, `refetchOnWindowFocus: false`.                                            | OK.                                                                                      |

## Mobile

| Item                  | Finding                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Images                | `expo-image` with auth headers; uploads go through `expo-image-manipulator` before multipart.            |
| Requests              | Timeouts on every request; no automatic mutation retries; queries retry ≤2 only on non-4xx.              |
| Duplicate submissions | `lockRef` guards on create; create retries now reuse the same temp property ID (see DATA_SYNC_AUDIT.md). |

## Infrastructure

- Health checks and restart policies defined for all prod services; Traefik health checks use `/live` (API) and `/healthz` (web).
- No container CPU/memory limits are set in `docker-compose.dokploy.yml`. Set them only after measuring real usage (e.g. a week of `/metrics` + `docker stats`); a reasonable starting point is worker ≥ 1 GB (Playwright) and API 512 MB–1 GB.

## How to measure next

1. Scrape `/metrics` (api_/worker_ default Node metrics: event-loop lag, heap, GC) from the internal network.
2. `scripts/load/surveyor-field-sim.mjs` already exists for surveyor traffic; run it against staging before/after the upgrade batch and compare p95 latency and `api_nodejs_eventloop_lag_seconds`.
