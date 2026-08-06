# P1 Ward Parity Implementation Plan

> **For agentic workers:** Execute with runtime debug evidence (session `cb377d`) before claiming fix success.

**Goal:** Nest active wards match Convex (number + name + code); no duplicate-ward abort; surveys remapped; one-click Align works in production.

**Architecture:** Harden `WardAlignService` sequential safe upserts + catalog-safe `ensureGeoForBundle`; verify report; debug NDJSON + response `_debug` for production.

**Tech Stack:** NestJS API, worker ETL, Prisma, Convex `list-ward-catalog`, Admin ETL UI.

## Global Constraints

- Success = count + number + name + code parity per ULB; surveys on keeper wards
- ETL creates wards only via catalog rules (normalized number + wardCode)
- Unique conflicts merge/continue — no fatal duplicate toast loop
- Keep UP `09`; QC APPROVED/REJECTED never overwritten
- Debug instrumentation stays until post-fix logs prove success

---

### Task 1: Runtime evidence on Align

**Files:** `apps/api/src/etl/ward-align.service.ts`

- [ ] Hypotheses A–E logged (entry, dedupe, sync upsert, unique catch, ensure exit)
- [ ] Dual emit: debug ingest + Nest logger; optional `_debug` on result for prod Network tab
- [ ] User reproduces Align apply once

### Task 2: Fix only confirmed paths

**Files:** `ward-align.service.ts`, `etl-orchestrator.service.ts` (`ensureGeoForBundle`)

- [ ] Fix unique abort / variant create based on log proof only
- [ ] Keep instrumentation; re-run verify

### Task 3: ensureGeo catalog-safe

**Files:** `apps/worker/src/etl/etl-orchestrator.service.ts`

- [ ] Match by code/normalized number; create one canonical row; no 01/1 twins
- [ ] Instrument create vs match branches

### Task 4: Verify UI + production smoke

**Files:** `etl-console.tsx` if needed

- [ ] Show verify/name mismatches; confirm `ok: true` after apply
