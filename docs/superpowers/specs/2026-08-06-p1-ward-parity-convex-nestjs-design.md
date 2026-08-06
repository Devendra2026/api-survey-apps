# P1 — Ward Parity: Convex ↔ Nest (Safe, Correct, One-Click)

**Date:** 2026-08-06  
**Status:** Approved (Approach 1 — harden Align + safe ETL geo)  
**Apps:** `api-survey-apps` (Admin/ETL), Convex Survey (`list-ward-catalog`)  
**Related:**

- `2026-08-05-convex-nestjs-sync-dedup-metrics-design.md`
- `2026-08-05-align-wards-with-convex-pipeline-design.md`

## Problem

1. ETL / Align can create **duplicate Nest wards** (e.g. `01` vs `1`, colliding `wardCode`).
2. Nest Tenants & Wards list diverges from Convex ward list → QC cannot find surveys under the expected ward.
3. Unique-constraint failures abort Align with repeated “duplicate code or name” toasts.
4. Operators need **one click** to make Nest match Convex without manual multi-step risk.

## Locked decisions

| Decision             | Choice                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Program order        | **P1** (wards) → P2 (drafts) → P3 (QC dashboard)                                                                                             |
| Success              | Nest active wards match Convex on **wardNumber + wardName + wardCode** per ULB; counts match; surveys remapped onto keeper wards after merge |
| Align UX             | Dry-run → confirm → apply (one primary button)                                                                                               |
| ETL missing ward     | **Catalog rules only** — normalize number + set wardCode/name; never invent variants                                                         |
| QC Approved/Rejected | ETL never overwrites terminal QC (unchanged)                                                                                                 |
| Empty UP shells      | Delete empty `01` / `UP` / `UP-01` only; keep **`09`**                                                                                       |
| Approach             | Harden one-click Align + safe `ensureGeo` (Approach 1)                                                                                       |

## Goal

After successful Align apply + ongoing ETL:

- Convex ward list ≡ Nest ward list (per ULB code).
- Survey rows remain on the correct Nest ward (post-merge).
- QC can locate surveys under the same ULB/ward identity as Survey App.
- Align completes without aborting on unique conflicts.

## Architecture

```
Convex list-ward-catalog (canonical wardNo, wardName, wardCode, municipalityCode)
        │
        ▼
POST /etl/align-wards-with-convex { apply }
  1. Dedupe by normalized wardNumber per ULB
     → remap surveys → soft-delete duplicates
  2. Sync upsert number / name / code from catalog
     → on unique conflict: merge + continue (no abort)
  3. Cleanup empty UP state shells (keep 09)
  4. Verify counts (+ sample name/code mismatches)
        │
        ▼
Survey ETL ensureGeoForBundle
  → match by wardCode OR normalized wardNumber
  → create at most one canonical active ward
  → never create 01/1 twin rows
```

### Ownership

| Data                         | Owner             | Nest role                           |
| ---------------------------- | ----------------- | ----------------------------------- |
| Ward masters                 | Convex            | Mirror via Align + catalog-safe ETL |
| Survey content while PENDING | Convex → Nest ETL | Conditional upsert                  |
| QC APPROVED / REJECTED       | Nest Admin        | Immutable to ETL                    |

## Align pipeline

### Endpoint

`POST /etl/align-wards-with-convex`

| Field    | Rule                                            |
| -------- | ----------------------------------------------- |
| Auth     | `etl:manage`                                    |
| Body     | `{ apply: boolean }`                            |
| Throttle | Skip or generous so one run is not rate-limited |

### Steps (fixed order)

1. **Dedupe** — group active wards by `normalizeWardNumber`; keep primary; remap surveys; soft-delete dupes; canonicalize primary `wardNumber`.
2. **Sync** — fetch Convex catalog; upsert Nest wards; sequential safe upsert (merge clashes; never throw unique as fatal toast).
3. **Cleanup** — delete empty states `01`, `UP`, `UP-01` only when zero districts and zero surveys.
4. **Verify** — per ULB `code`: Nest active ward count vs Convex catalog count; report name/code mismatches samples.

### Response (minimum)

```ts
{
  mode: "dry-run" | "apply",
  ok: boolean, // true iff zero count mismatches, zero missingUlbs, no fatal step abort
  steps: {
    dedupe: { duplicateGroups, wardsSoftDeleted, surveysRemapped, samples },
    sync: { catalogSize, created, updated, merged, skipped, missingUlbs, conflicts },
    cleanup: { deleted, skipped },
    verify: { matchedUlbCount, catalogSize, mismatchedUlbs, nameMismatches? }
  }
}
```

### Unique-conflict rule

- Never abort the pipeline with a raw Prisma “duplicate code or name” toast as the only outcome.
- Merge: remap surveys to keeper → soft-delete loser (clear `wardCode` on loser) → continue.
- Record non-fatal conflicts in `steps.sync.conflicts` if a row must be skipped after heal attempts.

## Survey ETL `ensureGeo`

1. Normalize incoming ward number with shared `normalizeWardNumber`.
2. Prefer match on `wardCode` when present; else normalized `wardNumber` among active wards in ULB.
3. If match: optionally refresh `wardName` / `wardCode` when empty or drifted from Convex payload.
4. If no match: **create one** active ward with canonical number, name, and code.
5. Forbidden: creating another active ward whose normalized number already exists in that ULB.

## UI

- ETL Sync primary CTA: **Align Wards with Convex**
- Dry-run first; confirm apply; show verify mismatches and missing ULBs
- Advanced single-step buttons optional / collapsed

## Validation (P1 done)

Hard:

- No two active Nest wards with same normalized `wardNumber` per ULB.
- After apply with `ok: true`, `verify.mismatchedUlbs` is empty.
- Spot-check Aminagar / Etah (and other UP `09` ULBs): number + name (+ code) match Convex.
- Surveys previously on soft-deleted dupes point at keeper ward.

Soft:

- QC users can open Master Data / registry filters and see the same ward labels as Survey App.

## Out of scope (P2 / P3)

- `refresh-pending` / draft body parity (P2)
- QC dashboard KPI polish and audit UX (P3)
- Nest→Convex QC write-back
- Creating missing Nest ULBs/districts from Convex
- Mega one-click (wards + surveys + verify) until P1+P2 stable (P4)

## Rollout

1. Deploy API (+ web) with hardened Align + ensureGeo rules.
2. Production: Align dry-run → review → apply once.
3. Confirm Master Data ward lists vs Convex; spot-check QC can find surveys by ward.
4. Proceed to P2 design only after P1 `ok: true` in production.

## Implementation notes

- Build on `WardAlignService.alignWardsWithConvex` and sequential `upsertWardSafe`.
- Audit worker `ensureGeoForBundle` for variant creation paths; align with catalog rules.
- Add debug/runtime logging around Align apply unique paths until production verify passes.
- Prefer verify name samples in sync/verify response for QC confidence.
