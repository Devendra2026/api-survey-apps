# Department roles and permissions (multi-client)

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Problem:** Municipal clients (e.g. Etah) need Admin / Clerk / Operator distinct from SDV Edutech platform survey roles, with SDV owning the permission template for every ULB client.

## Locked decisions

- Municipal users use **only** Admin / Clerk / Operator (codes `DEPT_ADMIN`, `DEPT_CLERK`, `DEPT_OPERATOR`)
- **SDV owns** the permission matrix; client Admin only assigns the three roles
- **ULB = client**; same template for every municipal ULB
- Dual catalogs: platform vs department

## Architecture

| Family     | Roles                                                                        | Scope                                     |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Platform   | `ADMIN`, `SURVEYOR`, `FIELD_SUPERVISOR`, `QC_SUPERVISOR`, `PENDING_APPROVAL` | As today                                  |
| Department | `DEPT_ADMIN`, `DEPT_CLERK`, `DEPT_OPERATOR`                                  | Requires `ulbId` (state/district derived) |

`Role.family` enum: `PLATFORM` | `DEPARTMENT`.

### Grant ceilings

- Platform `ADMIN` → all platform + all department roles
- `DEPT_ADMIN` → `DEPT_CLERK`, `DEPT_OPERATOR` within the same ULB
- Clerk / Operator → none

### Default dept permissions (SDV-editable)

- **Admin:** user view/create/update, role:assign, dashboard, survey view, report view/export
- **Clerk:** user view, survey view/update, report view, dashboard
- **Operator:** survey create/submit/view, photo create, dashboard

## UI

- **SDV Roles page:** tabs — Platform roles | Department template
- **Municipal (dept-only actors):** department roles only; read-only matrix; Assign Users allowed; no create/import/clone/metadata
- **Assign dialog:** dept roles need ULB; platform survey roles still need full geo; dept-only actors see Clerk/Operator only

## Out of scope

- Organization entity (ULB is the tenant)
- Client-editable permission matrix
- Replacing platform roles for SDV staff
