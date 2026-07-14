# Prisma Schema Review Report

**Date:** 2026-07-14  
**Source of truth:** `packages/database/prisma/schema.prisma`  
**Database:** PostgreSQL (`survey`) — existing data preserved

## Executive summary

The schema broadly covers municipal property-tax survey operations: geography hierarchy, Clerk identity, database-driven RBAC, survey lifecycle, floors, co-owners, photos, and survey audits. A baseline migration is now committed and verified against a clean disposable database. Remaining enterprise gaps are addressed via additive expand/contract migrations (GPS values, annual property identity, assignment attribution, private object-storage metadata, immutable audits, and import/export jobs).

## Migration baseline evidence

| Check               | Result                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| Drift `DB → schema` | Empty (no SQL changes)                                                 |
| Committed baseline  | `prisma/migrations/20260713041000_property_tax_domain/migration.sql`   |
| Existing DB         | Marked applied via `prisma migrate resolve --applied` (data preserved) |
| Clean DB apply      | SQL applied successfully; 14 domain tables created                     |
| Prior history issue | Failed migration with UTF-8 BOM removed; stub `init` record cleared    |

## Model inventory

| Domain    | Models                                           | Notes                                                           |
| --------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Geography | State → District → Ulb → Ward                    | Normalized FKs with `Restrict`; unique names/numbers per parent |
| Identity  | User                                             | Clerk `clerkUserId`; soft deactivate via `isActive`             |
| RBAC      | Role, Permission, RolePermission, UserTenantRole | No direct `User.role`; scoped assignments                       |
| Survey    | Survey, CoOwner, Floor, Photo, SurveyAudit       | Soft-delete on Survey; workflow timestamps                      |

## Business coverage

| Requirement                                           | Status                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Survey lifecycle (draft→submit→approve/reject→reopen) | Supported via `SurveyStatus`                                                   |
| Multi-tenant RBAC                                     | Supported; runtime must evaluate permissions **per assignment scope**          |
| Clerk auth mapping                                    | `User.clerkUserId` unique                                                      |
| Audit logging                                         | Partial — lifecycle audited; field-level and RBAC audits expanded in follow-up |
| Dashboard / reports / Excel import-export             | Supported over Survey; async jobs added for scale                              |
| Photos / S3                                           | URL-centric; durable object identity added for MinIO/S3 portability            |
| Floors / co-owners                                    | Supported                                                                      |
| GPS                                                   | **Incorrect** — enum axis labels, not coordinates (fixed additively)           |
| Property information                                  | Supported; annual ULB uniqueness planned                                       |

## Justified schema changes (implemented next)

1. **GPS** — add `latitude`/`longitude` (`Decimal(9,6)`) + accuracy/source; retain legacy `gpsCoordinates` during dual-read.
2. **Assignment** — add `assignedToId` / `assignedAt`; stop overwriting `createdById`.
3. **Annual identity** — `@@unique([ulbId, propertyId, assessmentYear])` after backfill; drop global `propertyId` unique.
4. **Photo storage** — `storageProvider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`, optional checksum/etag; keep `url` cache.
5. **Tenant role uniqueness** — partial unique on active assignments; `deactivatedAt`/`deactivatedBy`.
6. **Floor uniqueness** — `@@unique([surveyId, floorPosition])`.
7. **FRONT photo** — partial unique index (one FRONT per survey).
8. **Immutable audits** — SurveyAudit `onDelete: Restrict`; add `SecurityAudit` for RBAC mutations.
9. **Jobs** — `ImportJob` / `ExportJob` for worker workflow.

## Risks kept as application policy (not redesign)

- Geographic hierarchy consistency across Survey’s four FKs validated in services (imports/roles must match).
- Permission evaluation must remain bound to the assignment that grants the permission (not a global union).
- Expand/contract migrations required for any rename/drop of columns already in production.

## Production readiness checklist (schema)

- [x] Baseline migration committed
- [x] Drift checked empty before additive changes
- [x] Clean-database apply verified
- [x] Additive enterprise migration applied (`20260714020000_enterprise_domain_hardening`)
- [x] Catalog seed separated from demo seed
- [ ] Backup taken before production `migrate deploy`

## Additive migration summary

`20260714020000_enterprise_domain_hardening` introduced:

- Real GPS decimals + range checks
- `assignedToId` / `assignedAt` (creator preserved)
- Annual identity `@@unique([ulbId, propertyId, assessmentYear])`
- Photo storage metadata columns
- Tenant-role deactivation fields + active-scope unique index
- Floor position uniqueness; FRONT photo partial unique index
- Immutable `SurveyAudit` (`ON DELETE RESTRICT`)
- `SecurityAudit`, `ImportJob`, `ExportJob`
