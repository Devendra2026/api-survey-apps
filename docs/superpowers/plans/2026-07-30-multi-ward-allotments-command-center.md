# Multi-Ward Allotments & Command Center Ward Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Field roles can hold multiple ULB+ward pairs; command center lists all ACTIVE wards for a ULB with zero-filled stats.

**Architecture:** Keep `UserTenantRole`; accept `allotments[]` on assign; insert N active rows after deactivating priors. Command center left-joins Ward catalog to survey aggregates. UI uses a multi-row allotment editor for SURVEYOR / FIELD_SUPERVISOR / QC_SUPERVISOR.

**Tech Stack:** NestJS, Prisma, Next.js (apps/web), class-validator, React Query hooks

## Global Constraints

- App: `api-survey-apps` only (no Convex)
- No Prisma schema migration
- Field roles requiring full geo: `SURVEYOR`, `FIELD_SUPERVISOR`, `QC_SUPERVISOR`
- Ward required on every allotment for those roles
- Backward-compatible flat geo → single allotment
- Spec: `docs/superpowers/specs/2026-07-30-multi-ward-allotments-command-center-design.md`

## File map

| File                                                       | Responsibility                                          |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/users/dto/user.dto.ts`                       | `AllotmentGeoDto` + optional `allotments` on assign DTO |
| `apps/api/src/users/users.repository.ts`                   | `assignTenantRoles` bulk create in transaction          |
| `apps/api/src/users/users.service.ts`                      | Normalize allotments, validate, replace set             |
| `apps/api/src/command-center/command-center.repository.ts` | Catalog wards + left-join stats + label fix             |
| `apps/web/components/admin/user-allotments-editor.tsx`     | Shared multi-row geo editor                             |
| `apps/web/components/admin/user-onboard-wizard.tsx`        | Use editor + send allotments                            |
| `apps/web/components/admin/user-assign-role-dialog.tsx`    | Use editor + send allotments                            |
| `apps/web/components/admin/user-badges.tsx`                | Multi-ward chips                                        |
| `apps/web/hooks/use-api.ts` / types                        | Assign payload types if needed                          |

---

### Task 1: Assign DTO + repository bulk insert

**Files:**

- Modify: `apps/api/src/users/dto/user.dto.ts`
- Modify: `apps/api/src/users/users.repository.ts`

- [ ] **Step 1:** Add nested DTO and optional `allotments` array to `AssignTenantRoleDto`
- [ ] **Step 2:** Add `assignTenantRoles(userId, roleId, allotments[], assignedBy)` that `createMany` or loops create with include, after caller deactivates
- [ ] **Step 3:** Commit `feat(api): accept allotments array on tenant role assign`

### Task 2: UsersService multi-allotment assign

**Files:**

- Modify: `apps/api/src/users/users.service.ts`

- [ ] **Step 1:** Expand `ROLES_REQUIRING_FULL_GEO` to include `QC_SUPERVISOR`
- [ ] **Step 2:** Normalize `dto.allotments` or flat geo into `allotments[]`
- [ ] **Step 3:** For field roles: require ≥1, validate each (hierarchy, grant ceiling, duplicates), deactivate, insert all, audit with full set
- [ ] **Step 4:** Keep single-row path for Admin / dept roles
- [ ] **Step 5:** Commit `feat(api): multi ULB+ward allotments for field roles`

### Task 3: Command center ward catalog

**Files:**

- Modify: `apps/api/src/command-center/command-center.repository.ts`

- [ ] **Step 1:** Load ACTIVE wards for `ulbId`, filter by tenant scope
- [ ] **Step 2:** Left-join survey groupBy stats (zeros default)
- [ ] **Step 3:** Fix wardName label (no rewrite of non-Ward names)
- [ ] **Step 4:** Commit `fix(api): show all active wards on command center`

### Task 4: Web allotments UI

**Files:**

- Create: `apps/web/components/admin/user-allotments-editor.tsx`
- Modify: onboard wizard, assign dialog, user-badges
- Modify: types / assign mutation payload if typed

- [ ] **Step 1:** Build reusable allotments editor (add/remove rows, cascading selects)
- [ ] **Step 2:** Wire onboard + assign for field roles; include QC in GEO required
- [ ] **Step 3:** Multi-ward chips on badges
- [ ] **Step 4:** Commit `feat(web): multi-allotment editor for field roles`

### Task 5: Smoke verification

- [ ] Typecheck / lint touched packages
- [ ] Manual checklist: assign 2 wards, command center shows empty wards
