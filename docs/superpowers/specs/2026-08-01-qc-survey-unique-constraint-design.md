# QC Survey Unique Constraint Fix

**Date:** 2026-08-01  
**Status:** Implemented  
**App:** `api-survey-apps` (Nest + Prisma + Next admin)

## Problem

QC Save hits raw Prisma `P2002` on `survey.update` when the composite unique `(ulbId, propertyId, assessmentYear)` collides. Root causes:

1. App conflict check runs only when `propertyId` changes (assessment-year / ULB-only changes bypass it).
2. Soft-deleted rows still occupy the full unique index, while app checks filter `deletedAt: null`.
3. Live parcel swaps (61↔62) use a single update and collide with the peer’s active identity.

## Goals

- Partial unique index so soft-deleted surveys do not block re-allotment.
- Shared active-identity conflict helper with clear `ConflictException` messages.
- Implicit atomic swap on QC Save when claiming another active survey’s identity.
- Restore re-keys to `TEMP-RESTORE-{uuid}` when the old identity is already taken.
- Preserve QC behaviours: parcel/unit/use edits, mixed-use identities, ascending parcel/ward lists, 5-digit parcel search, next-queue navigation.

## Decisions

| Topic                      | Choice                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Live swaps                 | Implicit swap inside `qcCorrectSurvey` via temp `propertyId` (no dedicated swap API)   |
| Soft-delete reuse          | Partial unique `WHERE "deletedAt" IS NULL`                                             |
| Restore after re-allotment | Allow restore; re-key `propertyId` to `TEMP-RESTORE-{uuid}` if conflict                |
| Error UX                   | `Property ID <id> already exists for this ULB and assessment year (survey <otherId>).` |

## Schema

Prisma 7.9 in this monorepo does not accept `where` on `@@unique` (same as `Ward`). Active uniqueness is enforced only in SQL:

```sql
DROP INDEX IF EXISTS "surveys_ulbId_propertyId_assessmentYear_key";
CREATE UNIQUE INDEX "surveys_ulbId_propertyId_assessmentYear_active_key"
  ON "surveys" ("ulbId", "propertyId", "assessmentYear")
  WHERE "deletedAt" IS NULL;
```

Schema documents the constraint in comments; migration: `20260801140000_survey_active_identity_unique`.

## Components

1. **`survey-identity.util.ts`** — find conflict, assert available, allocate temp IDs, detect P2002.
2. **`qcCorrectSurvey`** — always check final identity; swap or conflict; never surface raw Prisma.
3. **`surveys.repository.restore`** — re-key on conflict before clearing `deletedAt`.
4. **`surveys.service` create/update** — shared message + assert when identity fields change.

## Out of scope

- Dedicated swap UI/API
- Hard-delete of soft-deleted surveys
- Changes to mixed-use floor modelling beyond existing unit/use identity rules
