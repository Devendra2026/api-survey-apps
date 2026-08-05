-- Add optional wardCode and partial unique index for active (ulbId, wardCode).
ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "wardCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "wards_ulbId_wardCode_active_key"
  ON "wards" ("ulbId", "wardCode")
  WHERE "deletedAt" IS NULL AND "wardCode" IS NOT NULL;

-- Add REFRESH_PENDING to MigrationJobType
DO $$ BEGIN
  ALTER TYPE "MigrationJobType" ADD VALUE 'REFRESH_PENDING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
