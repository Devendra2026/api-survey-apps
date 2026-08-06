-- Add optional wardCode and partial unique index for active (ulbId, wardCode).
ALTER TABLE "wards" ADD COLUMN IF NOT EXISTS "wardCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "wards_ulbId_wardCode_active_key"
  ON "wards" ("ulbId", "wardCode")
  WHERE "deletedAt" IS NULL AND "wardCode" IS NOT NULL;

-- ADD VALUE must be a top-level statement (not inside DO/PL/pgSQL).
-- IF NOT EXISTS keeps re-runs / partially applied envs idempotent.
ALTER TYPE "MigrationJobType" ADD VALUE IF NOT EXISTS 'REFRESH_PENDING';
