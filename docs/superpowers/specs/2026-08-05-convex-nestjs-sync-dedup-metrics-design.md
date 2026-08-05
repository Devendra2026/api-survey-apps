# Convex ↔ NestJS Sync, Ward Dedup & Admin KPI Alignment

**Date:** 2026-08-05  
**Status:** Approved (Approach 1 — targeted fixes)  
**Apps:** `api-survey-apps` (Admin/ETL), `sdv-monorepo-apps` (Convex Survey App)

## Problem

1. Admin Master Data shows duplicate/malformed wards (e.g. Aminagar 28 vs Survey 12; Etah 20 vs 26).
2. Admin dashboard KPIs (Draft / Pending QC / Approved QC) disagree with Survey App and can sum above Total.
3. ETL insert-once freezes Nest survey status at first import; draft→submitted never refreshes while QC remains Nest-owned.

## Locked decisions

| Decision                  | Choice                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| Field capture             | Convex → Nest via ETL                                                  |
| QC approve/reject         | Admin portal only; Nest owns Pending/Approved QC KPIs                  |
| Pending QC                | `surveyStatus=SUBMITTED AND qcStatus=PENDING` only                     |
| Nest→Convex QC write-back | No                                                                     |
| Ward masters              | Convex canonical; Nest cleaned + synced to match                       |
| Approach                  | Targeted fixes (normalize + dedupe + conditional upsert + bucket KPIs) |

## Architecture

```
Convex ward masters ──catalog sync──► Nest wards (canonical wardNumber + wardCode)
Convex surveys ──conditional upsert──► Nest surveys
Admin QC ──approve/reject──► Nest surveys (never overwritten by ETL once terminal)
Nest surveys ──classifySurveyBucket──► Admin dashboard KPIs
```

### Ownership

| Data                                   | Owner      | Consumer                                                         |
| -------------------------------------- | ---------- | ---------------------------------------------------------------- |
| ULB / Ward masters                     | Convex     | Nest mirrors via catalog sync; ETL must not invent variant wards |
| Field survey content + draft→submitted | Convex     | Nest upserts while Nest `qcStatus` is still `PENDING`            |
| QC decision (APPROVED / REJECTED)      | Nest Admin | No write-back to Convex                                          |
| Admin KPIs                             | Nest       | Pending QC = SUBMITTED + PENDING                                 |

### Hard rules

1. If Nest already has `qcStatus` APPROVED or REJECTED, ETL never overwrites QC fields.
2. ETL creates at most one Nest ward per normalized ward number per ULB.
3. Admin dashboard Pending QC must not use “all qcStatus=PENDING” (that includes drafts).

## Master data

### Canonical ward number

Same as Convex `normalizeWardNo`: numeric → strip leading zeros (`"01"` → `"1"`); alphanumeric kept trimmed (`"14A"`).

### Schema

- Optional `Ward.wardCode` (mirrors Convex).
- Partial unique `(ulbId, wardNumber)` where `deletedAt IS NULL` (existing).
- Partial unique `(ulbId, wardCode)` where `wardCode IS NOT NULL AND deletedAt IS NULL`.
- Admin API + ETL normalize `wardNumber` before write.

### Cleanup

Per ULB: group active wards by normalized number → pick primary → remap surveys → soft-delete duplicates → upsert missing from Convex catalog.

### ETL geo

`ensureGeoForBundle`: match by normalized number; create one canonical row only (no `1`/`01` variant loop).

## Survey ETL (conditional upsert)

| Nest state                                       | Action                                 |
| ------------------------------------------------ | -------------------------------------- |
| No row                                           | INSERT                                 |
| Exists, qcStatus=PENDING                         | UPDATE body + surveyStatus from Convex |
| Exists, qcStatus=APPROVED/REJECTED               | Do not overwrite QC/status             |
| migration_state COMPLETED but Nest still PENDING | `refresh-pending` reprocesses          |

Endpoints: `POST /etl/refresh-pending` + CLI `etl-run.mjs refresh-pending`.

## Admin dashboard KPIs

Drive from `classifySurveyBucket` / `tallySurveyBuckets`:

| KPI                 | Bucket       |
| ------------------- | ------------ |
| Drafts              | `fieldDraft` |
| Pending QC          | `pendingQc`  |
| Approved QC         | `approved`   |
| Rejected / Returned | `returned`   |

## Ops scripts

| Script                                   | Purpose                                          |
| ---------------------------------------- | ------------------------------------------------ |
| `scripts/ops/dedupe-wards.mjs`           | Dry-run default; `--apply` remaps + soft-deletes |
| `scripts/ops/sync-wards-from-convex.mjs` | Upsert Nest wards from Convex catalog            |

## Rollout

1. Deploy code (ETL + dashboard + normalize).
2. Dry-run dedupe + catalog sync; review Aminagar / Etah.
3. `--apply` dedupe, then catalog sync.
4. Run `refresh-pending`.
5. Verify Admin Master Data + dashboard KPIs.

## Out of scope

- Nest→Convex QC write-back
- Changing Convex Survey App KPI formulas
- Full image re-download for COMPLETED surveys

## Validation

- Hard: no two active Nest wards with same normalized number per ULB; Nest vs Convex ward counts per ULB code.
- Soft: Nest Pending QC vs Convex submitted+pending (expected diverge after Admin QC).
- Smoke: Aminagar / Etah lists match Convex; `draft + pendingQc + approved + returned ≈ total`.
