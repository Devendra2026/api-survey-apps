# Ward List Geo Permissions & Allotment UX

**Date:** 2026-07-30  
**Status:** Implemented  
**App:** `api-survey-apps`  
**Builds on:** `2026-07-30-multi-ward-allotments-command-center-design.md` (Approach A — per-ward allotments)

## Problem

1. Ward dropdowns were empty: `useWards` called `/wards?limit=200` while API pagination `@Max(100)` rejected the request.
2. Geo cascade (`/states`, `/districts`, `/ulbs`, `/wards`) required `settings:view` only. DEPT_ADMIN (`role:assign`) and field roles (`survey:view`) could not load lists for onboard or Command Center.
3. Allotment UI was one row per ward with silent empty selects — painful for multi-city assignment.
4. Onboard confirm showed presence labels (“State → Ward”) instead of resolved names.
5. Command Center auto-selected hardcoded Bhopat / aminagar / Ward 05, masking empty/error states.

## Goals

- Fix ward list fetch (`limit=100`).
- Allow geo **read** with `settings:view` **OR** `role:assign` **OR** `survey:view`.
- City-group allotment UX: State → District → ULB once, then multi-select wards (still one `UserTenantRole` row per ward).
- Show loading/error/empty on geo selects; resolve names on confirm.
- Soften Command Center defaults (first state only); surface filter load errors.

## Non-goals

- ULB-wide allotment without wards.
- Raising global pagination max above 100.
- New Prisma tables or QC work-queue model.

## API

### `RequireAnyPermission`

- Metadata key `any_permissions`; `PermissionsGuard` OR-checks before AND `RequirePermission`.
- Geo GET list / GET by id on states, districts, ulbs, wards use:

```ts
RequireAnyPermission(settings:view, role:assign, survey:view)
```

- Mutations remain `settings:manage`.

## UI

- `user-allotments-editor.tsx`: city groups + checkbox ward multi-select → flat `allotments[]` payload.
- `AllotmentSummaryList` for onboard confirm.
- `command-center-filters.tsx`: geo load hints; no district/ULB/ward auto-pick.

## Success criteria

1. Command Center ward dropdown populates after ULB select; ward grid still catalog-first.
2. Onboard/assign multi-ward across ULBs works for ADMIN and DEPT_ADMIN.
3. Field roles with `survey:view` can cascade geo within tenant scope.
4. Empty selects show loading or error, not silence.
