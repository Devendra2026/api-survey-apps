# User hard delete (DB + Clerk)

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Problem:** Admin “Delete user” only set `isActive: false` (same as Disable). The UI labeled it Delete while the row and Clerk account remained.

## Goals

- `DELETE /users/:id` permanently removes the Postgres `User` row and the Clerk user when safe.
- Refuse delete with a clear conflict message when Restrict FK references still exist.
- Keep Disable / Activate as `isActive` toggles only.
- Pending users (`clerkUserId` prefix `pending:`) delete from DB only (no Clerk call).

## Non-goals

- Changing Prisma `onDelete` rules or nulling/reassigning historical FKs.
- Changing survey soft-delete behavior.
- Force-deleting users who authored surveys, audits, or jobs.

## Behavior

| Action             | Behavior                                               |
| ------------------ | ------------------------------------------------------ |
| Disable / Activate | Toggle `isActive` (unchanged)                          |
| Delete             | Permanent: remove Postgres user + Clerk user when safe |

**Guards**

- Cannot delete yourself.
- Same tenant-scope checks as today.
- If any blocking reference exists → `409 Conflict` listing what blocks (e.g. “3 surveys created, 12 survey audit entries”).
- Pending Clerk ids: DB delete only.

## Flow

```text
DELETE /users/:id
  → self-delete / scope checks
  → count Restrict FK blockers
  → if any → ConflictException with reasons
  → securityAudit USER_DELETED (actor = admin)
  → prisma.user.delete (cascades own roles + saved views)
  → clerk.users.deleteUser (skip pending; not-found = ok)
```

## Blocking relations (Restrict)

- Surveys created / assigned
- Survey audits changed
- Security audits as actor
- Import / export jobs created
- QC remarks authored
- Roles assigned (`assignedBy`) / deactivated (`deactivatedBy`)

Cascades already in schema: own `UserTenantRole` rows, `SavedView`s.

## UI

- Delete dialog and bulk delete copy describe permanent removal (not soft-delete / reactivate).
- Prefer Disable for temporary access block.
- Surface API conflict messages via existing error toasts.

## Testing

- Clean delete succeeds; Clerk called for real clerk ids.
- Blocked delete returns conflict with reasons.
- Pending user skips Clerk.
- Self-delete forbidden.
