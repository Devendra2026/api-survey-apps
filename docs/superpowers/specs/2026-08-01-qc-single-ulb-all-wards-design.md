# QC Single-ULB + All Wards Allotments

**Date:** 2026-08-01  
**Status:** Implemented  
**App:** `api-survey-apps` (Nest + Prisma + Next admin)  
**Approach:** Extend `UserTenantRole` allotments; `wardId: null` = All Wards within ULB

## Problem

1. QC Supervisors can hold multiple ULB allotments today; product requires **one Location (ULB)** per QC.
2. Field roles cannot express **All Wards** without materializing every ward row; new wards then fall outside scope.
3. Admin users table lacks quick chip → Grant Permission editing for location/ward.

## Goals

- **QC_SUPERVISOR:** exactly one ULB; ward mode = Single Ward **or** All Wards.
- **All Wards:** one `UserTenantRole` with `ulbId` set and `wardId: null` (ULB-wide via existing `resolveTenantScope`).
- **SURVEYOR / FIELD_SUPERVISOR:** multi-ULB retained; per ULB either specific ward(s) **or** one All Wards row (not both).
- Admin UX: Location/Ward chips open Grant Permission modal; KPI strip shows Total Users, Active QC, Active Surveyors, Locations Assigned.
- Dirty-aware Save; toasts; Framer Motion with reduced-motion respect.

## Non-goals

- Surveyor Location Switcher UI.
- Hard-locking QC portal filters beyond existing tenant scope.
- Renaming `ADMIN` → `SUPER_ADMIN`.
- Destructive migration of existing multi-ULB QC rows (reject on next assign; UI warning).

## Data rules

| Role                            | ULBs      | Ward per ULB                                    |
| ------------------------------- | --------- | ----------------------------------------------- |
| `QC_SUPERVISOR`                 | Exactly 1 | One `wardId` **or** one row with `wardId: null` |
| `SURVEYOR` / `FIELD_SUPERVISOR` | 1+        | Per ULB: N ward rows **or** one All Wards row   |
| `ADMIN` / dept roles            | Unchanged | Unchanged                                       |

## API

`AllotmentGeoDto.wardId` optional. Omitted/empty → store `null`.

Validation errors (examples):

- QC with multiple ULBs → 400
- QC with multiple wards when not All Wards → 400
- Same ULB with both specific wards and All Wards → 400

## UI

- `UserAllotmentsEditor` modes: `qc` | `field`
- All Wards toggle → “Unrestricted Access” pill
- `GrantPermissionModal` from chips / Grant Location action

## Success criteria

- QC All Wards assignment creates one null-ward row; scope includes all surveys in that ULB.
- QC multi-ULB assign fails at API and is blocked in UI.
- Surveyor can mix Etah (specific wards) + Baghpat (All Wards).
- Chip edit Save disabled until dirty; toast on success.
