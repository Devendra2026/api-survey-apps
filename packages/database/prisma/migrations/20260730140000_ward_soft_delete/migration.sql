-- Soft-delete support for wards; active uniqueness only among non-deleted rows.
ALTER TABLE "wards" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "wards_deletedAt_idx" ON "wards"("deletedAt");

DROP INDEX IF EXISTS "wards_ulbId_wardNumber_key";

CREATE UNIQUE INDEX "wards_ulbId_wardNumber_active_key"
  ON "wards" ("ulbId", "wardNumber")
  WHERE "deletedAt" IS NULL;
