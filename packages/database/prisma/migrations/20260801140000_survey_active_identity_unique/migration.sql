-- Soft-deleted surveys must not block re-allotment of (ulbId, propertyId, assessmentYear).
-- Active uniqueness only among rows WHERE "deletedAt" IS NULL.

DROP INDEX IF EXISTS "surveys_ulbId_propertyId_assessmentYear_key";

CREATE UNIQUE INDEX "surveys_ulbId_propertyId_assessmentYear_active_key"
  ON "surveys" ("ulbId", "propertyId", "assessmentYear")
  WHERE "deletedAt" IS NULL;
