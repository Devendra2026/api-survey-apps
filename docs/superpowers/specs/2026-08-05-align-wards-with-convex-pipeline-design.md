# Align Wards with Convex — One-Click Pipeline

**Date:** 2026-08-05  
**Status:** Approved (Approach 1 — single pipeline API + confirm UI)  
**App:** `api-survey-apps` (Admin ETL)  
**Related:** `2026-08-05-convex-nestjs-sync-dedup-metrics-design.md`

## Problem

Operators must run ward alignment as separate ETL actions (dedupe → sync → cleanup → verify). That is slow, easy to throttle, and easy to stop mid-way so Nest ward masters diverge from Convex.

## Locked decisions

| Decision                  | Choice                                                          |
| ------------------------- | --------------------------------------------------------------- |
| Success = match Convex    | **Wards / ULBs only** (not survey KPIs)                         |
| UX                        | One button → dry-run preview → confirm → apply                  |
| Architecture              | Single sync HTTP pipeline (Approach 1), not Bull job            |
| Survey Refresh Pending    | Out of scope for this pipeline                                  |
| Nest→Convex QC write-back | Out of scope                                                    |
| Canonical UP state        | Keep code `09`; cleanup empty shells `01` / `UP` / `UP-01` only |

## Goal

After a successful **apply**, Nest active ward counts and codes per ULB match the Convex ward catalog (`list-ward-catalog`). Missing Nest ULBs are reported; this pipeline does not create districts/ULBs.

## Architecture

```
Admin UI (ETL Sync)
  │  1) POST align-wards-with-convex { apply: false }
  │  2) Confirm dialog
  │  3) POST align-wards-with-convex { apply: true }
  ▼
POST /etl/align-wards-with-convex
  │
  ├─ 1. Dedupe (normalized ward number per ULB)
  ├─ 2. Sync from Convex catalog
  ├─ 3. Cleanup empty UP state shells
  └─ 4. Verify Nest vs Convex counts per ULB code
```

### Ownership (unchanged)

| Data                          | Owner               | Nest role                           |
| ----------------------------- | ------------------- | ----------------------------------- |
| Ward masters                  | Convex              | Mirror via catalog sync             |
| ULB / district / state shells | Nest (existing geo) | Must exist for sync to attach wards |
| QC / survey KPIs              | Nest Admin          | Not part of this pipeline           |

## API

### Endpoint

`POST /etl/align-wards-with-convex`

| Field    | Rule                                                                        |
| -------- | --------------------------------------------------------------------------- |
| Auth     | Bearer + `etl:manage`                                                       |
| Body     | `{ apply: boolean }` (`false` = dry-run, `true` = write)                    |
| Throttle | Generous or `@SkipThrottle()` so one pipeline is not rate-limited mid-click |

### Step order (fixed)

1. **Dedupe** — group active wards by normalized number; keep primary; remap surveys; soft-delete duplicates.
2. **Sync** — fetch Convex `list-ward-catalog`; upsert Nest wards (batch load ULBs/wards; createMany / parallel updates; merge code/number clashes).
3. **Cleanup** — delete states coded `01`, `UP`, `UP-01` only when they have **zero** districts and **zero** surveys; never delete `09`.
4. **Verify** — compare Nest active ward count vs Convex catalog count per ULB `code`.

### Response

```ts
{
  mode: "dry-run" | "apply",
  ok: boolean, // true iff verify has zero mismatches and no step aborted
  steps: {
    dedupe: {
      duplicateGroups: number
      wardsSoftDeleted: number
      surveysRemapped: number
      samples: Array<{ ulb: string; norm: string; primary: object; dupes: object[] }>
    }
    sync: {
      catalogSize: number
      created: number
      updated: number
      merged: number
      skipped: number
      missingUlbs: string[]
      conflicts: string[]
    }
    cleanup: {
      deleted: Array<{ id: string; code: string; name: string }>
      skipped: Array<{ id: string; code: string; name: string; reason: string }>
    }
    verify: {
      matchedUlbCount: number
      catalogSize: number
      mismatchedUlbs: Array<{ ulb: string; nest: number; convex: number }>
    }
  }
}
```

### Error / partial-write rules

- Convex unreachable or secret misconfigured → fail before writes when possible (`ServiceUnavailable` / `BadRequest`); return clear message.
- On apply, run steps in order; if a step throws after writes started, return which step failed + prior step results; do not continue later steps.
- Unique conflicts inside sync use merge/retry; if still blocked, `ok: false`, `steps.sync.conflicts` populated.
- `missingUlbs` alone does not abort the pipeline, but `ok` is false until verify mismatches are empty (missing ULBs typically cause count gaps).

## UI (ETL Sync)

1. Primary button: **Align Wards with Convex**.
2. Click runs dry-run (`apply: false`); show per-step summary + top mismatched ULBs.
3. Confirm dialog → apply (`apply: true`).
4. Show final report; highlight `ok` vs remaining mismatches.
5. Existing granular buttons (Dedupe / Sync / Cleanup) may remain under **Advanced** or stay visible; primary path is the one-click pipeline.

## Performance

Reuse batched ward-align work already in `WardAlignService`:

- Load all ULBs + active wards once per sync.
- `createMany` in chunks; bounded parallel updates/merges.
- Dedupe loads all wards in one query, not per ULB.

Pipeline orchestrator calls existing methods sequentially and aggregates into the response shape above (no N+1 reintroduction).

## Out of scope

- `refresh-pending` / survey body sync
- Nest→Convex QC write-back
- Creating missing ULBs, districts, or states from Convex
- Full KPI parity (Draft / Pending / Approved)

## Validation

Hard:

- No two active Nest wards with the same normalized `wardNumber` per ULB.
- After apply with `ok: true`, `verify.mismatchedUlbs` is empty.
- Empty UP shells `01` / `UP` / `UP-01` removed when empty; `09` remains.

Smoke:

- Aminagar / Etah (and other UP ULBs under `09`) ward lists match Convex catalog counts.
- Master Data accordion ward counts match verify report.

## Rollout

1. Deploy API + web with pipeline endpoint and UI button.
2. Operator: **Align Wards with Convex** → review dry-run → Confirm apply.
3. Confirm Master Data ward counts; fix any `missingUlbs` by creating Nest ULBs only if product requires those municipalities.

## Implementation notes (for plan)

- Add `alignWardsWithConvex(apply)` on `WardAlignService` (or thin `EtlService` wrapper) composing `dedupeWards` → `syncWardsFromConvex` → `cleanupEmptyDuplicateStates` → verify.
- On sync `apply`, avoid double-dedupe if pipeline already ran dedupe (pass flag or skip internal pre-sync dedupe when called from pipeline).
- Wire `POST /etl/align-wards-with-convex` + DTO + web `etl-api` + ETL console primary CTA.
