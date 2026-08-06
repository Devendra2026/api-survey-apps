# Baghpat QC Dashboard Parity — Safe Convex ↔ Nest Sync (Etah Protected)

**Date:** 2026-08-06  
**Status:** Approved (Approach 1 — scoped reconcile + safe refresh)  
**Apps:** `api-survey-apps` (Admin/ETL), `sdv-monorepo-apps` (Convex Survey App)  
**Related:**

- `2026-08-05-convex-nestjs-sync-dedup-metrics-design.md`
- `2026-08-06-p1-ward-parity-convex-nestjs-design.md`
- `2026-08-05-align-wards-with-convex-pipeline-design.md`

## Problem

1. NestJS QC Command Center (`survey.sdvedutech.in`) and Convex QC Command Center (`admin.sdvedutech.in`) disagree on ward cards and KPIs.
2. Example — Aminnagar Sarai Ward 6 (Indra market): Nest showed Drafts 4 / Pending 167 / Total 171 vs Convex Drafts 63 / Pending 84 / Total 147.
3. Global Nest KPIs: QC done **7204**, Pending **4532**, Field Drafts **2863**; Convex Field Drafts **1415** (Nest over-counts drafts).
4. QC team is actively working **Etah** wards in production. Any fix must not disrupt Etah approve/reject or pending queues.

## Root cause (summary)

1. **Two stores, no live join** — Nest cards read Postgres buckets; Convex cards read `surveyWardStats` rollups.
2. **ETL insert-once freeze** — Incremental sync skips `migrationState=COMPLETED`, so Nest `surveyStatus` does not track Convex draft→submitted unless `refresh-pending` runs.
3. **Counting rules differ** — Nest uses mutually exclusive lifecycle buckets; Convex uses overlapping status/qcStatus counters.
4. **Ward identity drift** — Nest may remap orphan/soft-deleted ward IDs onto active cards, inflating or shifting ward totals.

## Locked decisions

| Decision                        | Choice                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approach                        | **1** — Scoped reconcile + safe refresh (Baghpat first)                                                                                                                          |
| Phase 1 scope                   | **All Baghpat district ULBs** only                                                                                                                                               |
| Etah                            | **Untouched** until agreed off-hours (Phase 2)                                                                                                                                   |
| Field SoT                       | Convex (`draft` / `submitted` content)                                                                                                                                           |
| Terminal QC SoT                 | Nest (`APPROVED` / `REJECTED`); never overwritten by ETL                                                                                                                         |
| Nest→Convex QC write-back       | No                                                                                                                                                                               |
| Global drafts → 1415 in Phase 1 | **No** — do not force; expected to stay high until Etah Phase 2                                                                                                                  |
| Job scope                       | `districtId` **required**; missing scope → reject job (never default to all districts)                                                                                           |
| Phase 1 success                 | Every Baghpat ULB: Nest Field Drafts / QC Pending / QC Approved match Convex field counters for the same ULB+ward set after align; Nest Total equals Nest bucket sum on that set |

## Architecture

```
Convex field surveys
        │
        ├─► Read-only reconcile (Baghpat districtId)
        │
        ├─► Align wards (Baghpat ULBs only) dry-run → apply
        │
        └─► refresh-pending (Baghpat districtId only)
                │  updates Nest PENDING surveyStatus/body from Convex
                │  skips APPROVED/REJECTED
                │  skips non-Baghpat
                ▼
        Nest Postgres ──classifySurveyBucket──► Nest QC Command Center

Etah surveys + QC queue ── frozen until Phase 2 ──
```

### Ownership

| Data                                        | Owner        | Nest role                                        |
| ------------------------------------------- | ------------ | ------------------------------------------------ |
| Ward masters                                | Convex       | Mirror via Align (Baghpat-scoped in Phase 1)     |
| Field content while Nest `qcStatus=PENDING` | Convex → ETL | Conditional upsert / refresh                     |
| QC APPROVED / REJECTED                      | Nest Admin   | Immutable to ETL                                 |
| Nest QC dashboard KPIs                      | Nest         | After sync, PENDING field buckets reflect Convex |

## Production safety rules

1. **District allowlist only** — Align apply, refresh-pending, and any PENDING incremental update require `districtId` (Baghpat in Phase 1). Missing → HTTP 400 / no job.
2. **Etah out of scope** — Worker skips surveys whose Nest `districtId` ≠ job scope; log `skippedOutOfScope`.
3. **Terminal QC immutable** — Never change status, body, photos, or ward when Nest `qcStatus` is `APPROVED` or `REJECTED`.
4. **PENDING-only field refresh** — Update `surveyStatus` / geo / field body from Convex; keep Nest `qcStatus=PENDING`.
5. **No global KPI force-match** — Do not soft-delete or invent drafts to make Nest global drafts equal 1415 during Phase 1.
6. **Dry-run before apply** — Align and refresh expose dry-run counts (`wouldUpdate` / `wouldSkip` / mismatches) before live apply.
7. **Etah QC UX unchanged** — Approve/reject, Start QC, and Etah queue order behave exactly as today.

## Ops sequence (Phase 1)

1. **Reconcile (read-only)** — `districtId` = Baghpat. Join Nest `Survey.legacySurveyId` ↔ Convex survey `_id`. Emit per ULB/ward: `onlyConvex`, `onlyNest`, `statusMismatch`, `wardMismatch`, `ok`.
2. **Align wards** — Baghpat ULBs only. Dry-run → confirm → apply. Dedupe twin wards; remap surveys; soft-delete losers.
3. **Refresh PENDING** — Baghpat only. Dry-run → apply. Sync Convex field status into Nest PENDING rows.
4. **Verify** — Every Baghpat ULB: Nest Command Center cards match Convex. Spot-check Aminnagar Ward 6.
5. **Stop** — Do not start Etah until Phase 2 off-hours window (same pipeline with Etah `districtId`).

## Components

| Piece                             | Behavior                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /etl/reconcile-with-convex` | Read-only; body `{ districtId }` required                                                    |
| `POST /etl/refresh-pending`       | Extend with `{ districtId, apply?, batchSize? }`; refuse if `districtId` missing             |
| Align wards path                  | Accept/require district (or ULB list derived from Baghpat); never process Etah in Phase 1    |
| Worker filter                     | Before upsert: Nest `districtId` must match job scope                                        |
| ETL console                       | District picker + dry-run / apply for Phase 1                                                |
| Transform default                 | Unmapped Convex status must not become `SUBMITTED`; map `draft` → `DRAFT` explicitly or skip |

Optional follow-up (not required for Phase 1 success): incremental PENDING sync gated by district allowlist or feature flag so COMPLETED migrations no longer freeze forever.

## Error handling

| Case                       | Behavior                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| Missing `districtId`       | 400; no job started                                                |
| Align unique conflicts     | Merge/continue (existing P1 rule); never abort unrelated districts |
| Per-survey refresh failure | Log + continue; job summary lists failed IDs                       |
| Terminal QC row            | Skip (not fail)                                                    |
| Out-of-scope district      | Skip + `skippedOutOfScope` count                                   |

## Testing

- Unit: scope filter skips Etah when job `districtId` = Baghpat
- Unit: APPROVED / REJECTED never updated
- Unit: PENDING draft↔submitted refresh only
- Unit: transform does not default unknown status to SUBMITTED
- Smoke: Baghpat ULB card parity after dry-run → apply

## Success criteria

### Phase 1 (Baghpat)

- Every Baghpat ULB: after ward align + PENDING refresh, Nest Field Drafts / QC Pending / QC Approved match Convex for the same ULB+ward survey set (`legacySurveyId` join).
- Nest Total = Nest bucket sum on that set. If Nest still has returned/rework-only rows not mirrored in Convex counters, list them in the reconcile report (do not silently delete).
- Etah QC approve/reject and pending queues unchanged.
- Nest global Field Drafts may remain **2863** until Phase 2 (expected).

### Phase 2 (off-hours, Etah)

- Same pipeline with Etah `districtId`.
- After Phase 2, Nest global Field Drafts should move toward Convex **1415** (residual Nest-only / returned/rework differences documented if any).

## Out of scope

- Nest→Convex QC write-back
- Redesigning Convex rollups to Nest bucket math
- Forcing Nest global drafts to 1415 during Phase 1
- Changing Etah survey data while QC is live
- P4 mega one-click (wards + surveys + verify) until Phase 1 verify is green

## Rollout

1. Ship scoped reconcile + district-gated refresh/align (code).
2. Operator runs Phase 1 on Baghpat only; verify all Baghpat ULBs.
3. Etah QC continues uninterrupted.
4. Schedule Phase 2 off-hours for Etah; then re-check global draft KPI.
