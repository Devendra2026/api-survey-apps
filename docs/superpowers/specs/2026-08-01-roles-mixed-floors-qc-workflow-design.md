# Roles, Mixed Floors & QC Workflow

**Date:** 2026-08-01  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Phased vertical slices (Roles → Mixed floors → QC)

## Problem

1. Roles UI uses a permission matrix; product wants Display name / Key / Description form plus grouped checkbox cards, with full edit of system roles and a system-role warning banner.
2. Mixed-use plots (e.g. residential + commercial on the same ground floor) cannot be stored because `Floor` is unique on `(surveyId, floorPosition)`.
3. QC Supervisors need a clear soft Active Ward session, Reject with auto-next, and manual parcel jump.

## Locked decisions

| Decision     | Choice                                                           |
| ------------ | ---------------------------------------------------------------- |
| Delivery     | Phased: Roles → Floors → QC                                      |
| Roles UI     | Form + grouped permission cards (replace matrix)                 |
| System roles | Full permission edit; warning copy only (no Refresh RBAC button) |
| Floors       | Multiple rows per floor position with different `usageFactor`    |
| Floor unique | `(surveyId, floorPosition, usageFactor)`; `usageFactor` required |
| QC ward      | Soft Active Ward session; no server exclusive lock               |
| Permissions  | Keep `survey:approve` / `survey:reject` / `role:assign`          |
| Stack        | NestJS + Prisma + Next.js (not Convex)                           |

## Non-goals

- Refresh system RBAC admin action
- Convex / renaming keys to `qc.decide` / `qc.reopen`
- Hard server-side ward locks
- Remodeling mixed parcels as separate R/C surveys only

## Phase 1 — Roles

- Left panel: System vs Custom grouping; **SYS** / **CUSTOM** badges.
- Right panel: Display name, Key (read-only), Description; system warning banner; grouped searchable permissions with per-group clear and selected counts; session-refresh footer note.
- Unlock API/web `system-role-policy` so all system roles accept full permission sets via `PUT /roles/:id/permissions`.

## Phase 2 — Mixed floors

- Migrate unique constraint; require `usageFactor`.
- Floors API, QC sync, ETL, Excel import allow same position + different usage.
- QC floor editor supports multiple usage rows on the same floor.
- Tax calc charges each floor row independently.

## Phase 3 — QC workflow

- Soft Active Ward label `{ULB} – Ward {n}`.
- Reject UI + auto-advance after Approve/Reject; Reopen stays put.
- Parcel jump via `GET /qc/queue/by-parcel?wardId=&parcelNumber=`.
- Command Center Start QC → first pending review.

## Testing

- Roles: save/remove on system roles; custom; dept read-only.
- Floors: dual usage on GROUND_FLOOR; QC save; ETL/import; duplicate usage conflict.
- QC: reject advances; parcel jump; ward label; Start QC.
