# Data Synchronization Audit

Date: 2026-11-06

## Architecture

```
Mobile (Expo) ──┐                         ┌──► PostgreSQL (source of truth, Prisma 7, pool 10/service)
                ├──► NestJS API ──────────┼──► Redis (BullMQ queues only; no business data cached)
Web (Next 16) ──┘        │                └──► MinIO/S3 (photos, import workbooks, exports)
                         ▼
                   BullMQ queues ──► Worker (imports, exports, ETL, image migration, storage cleanup) ──► PostgreSQL / MinIO
```

Both clients call the same REST API with Clerk session JWTs and share `@workspace/validation` schemas. There is no client-side business cache beyond TanStack Query.

## Findings

| Area                                | Status         | Notes                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth                     | OK             | All persistent state is in PostgreSQL. Redis holds only BullMQ job state (bounded: `removeOnComplete`/`removeOnFail` counts on every queue).                                                                                                                                                                                                                                                   |
| API contracts web ↔ mobile          | OK             | Same endpoints and envelope (`{ success, message, data, errors }`); shared zod schemas.                                                                                                                                                                                                                                                                                                        |
| Tenant consistency of lists/exports | **Fixed (S1)** | Searches and exports could return out-of-tenant rows, so web, mobile and Excel showed different data for the same scope. Tenant filter now cannot be overridden.                                                                                                                                                                                                                               |
| Mobile survey create retries        | **Fixed**      | `NewSurveyScreen` generated a new random temporary `propertyId` on every tap. A timeout after the server committed → retry → a second orphan draft. Now the temp ID is reused per (ULB, ward, year) until success; a retry that hits the `(ulbId, propertyId, assessmentYear)` partial unique index (409) loads the existing draft via `GET /surveys/:propertyId` instead of creating another. |
| Mobile owner merge                  | **Fixed**      | `mergeCoOwners` returned the caller's readonly array when nothing local was pending, so later edits could alias cached query data. Now always returns a new array (also fixed a TS error that broke `pnpm --filter mobile typecheck`).                                                                                                                                                         |
| Mobile cache isolation              | OK             | Query keys scoped by Clerk user id; cache cleared on sign-out/user switch; no retries on 4xx; mutations never auto-retry.                                                                                                                                                                                                                                                                      |
| Mobile request timeouts             | OK             | 30 s JSON / 90 s multipart with `AbortController`; network vs timeout vs config errors distinguished.                                                                                                                                                                                                                                                                                          |
| Photo uploads                       | OK             | Server re-validates MIME + magic bytes; on DB failure the uploaded object is deleted; replace deletes the previous key after commit.                                                                                                                                                                                                                                                           |
| Web refresh                         | OK             | `staleTime` 30 s default, focus refetch off; job polling (imports/ETL) runs at 2 s **only while a job is QUEUED/PROCESSING**, then stops.                                                                                                                                                                                                                                                      |
| Worker → DB                         | OK             | Import/export jobs use BullMQ retries with exponential backoff; ETL pages use deterministic job ids to avoid duplicate pages on stall/retry.                                                                                                                                                                                                                                                   |
| Clerk user sync                     | OK             | Webhook (Svix-verified) upserts/deactivates; JIT creation on first request refuses to create placeholder rows if the Clerk profile fetch fails; identity invariant `User.clerkUserId === JWT sub` enforced.                                                                                                                                                                                    |
| Time zones                          | OK with caveat | Prisma `DateTime` columns are `timestamp(3)` **without** time zone (81 columns, none `@db.Timestamptz`); Prisma always writes UTC and the API returns ISO-8601 UTC. Date-range filters are built in UTC (`setUTCHours`), so a "day" filter is a UTC day, not an IST day (5h30 offset). Raw SQL or external tools reading these columns must assume UTC.                                        |

## Not changed / recommendations

- **Survey autosave concurrency**: PATCH is last-write-wins. Two devices editing the same survey can overwrite each other. Recommend an `updatedAt`/version precondition (`If-Match`) on survey PATCH; needs a client change on web and mobile together.
- **Generic idempotency keys**: other create endpoints (co-owners, floors) rely on unique constraints rather than an `Idempotency-Key` header. The floors table has a composite unique; co-owners do not. Low risk because users see the created row, but worth adding if offline queuing is introduced.
- **No offline queue on mobile**: writes fail fast with a retryable error. This is consistent (no hidden divergence) but means field users must retry manually.

## Verification

- `apps/mobile`: `tsc --noEmit` clean, 168/168 `node --test` tests pass.
- Tenant filter regression test: `apps/api/src/common/utils/tenant-scope.util.spec.ts` ("keeps the tenant filter when callers spread a search OR or an id selection after it").
- The mobile create-retry path is covered by typecheck and code review only; it was **not** exercised on a device or emulator in this audit.
