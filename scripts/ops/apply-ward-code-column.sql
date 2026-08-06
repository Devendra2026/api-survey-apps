-- Apply on production Postgres if Align fails with:
--   The column `wards.wardCode` does not exist in the current database.
-- Safe / idempotent (IF NOT EXISTS).
-- Migration folder: 20260805120000_ward_code_refresh_pending

ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "wardCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "wards_ulbId_wardCode_active_key"
  ON "wards" ("ulbId", "wardCode")
  WHERE "deletedAt" IS NULL AND "wardCode" IS NOT NULL;

DO $$ BEGIN
    ALTER TYPE "MigrationJobType" ADD VALUE 'REFRESH_PENDING';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
