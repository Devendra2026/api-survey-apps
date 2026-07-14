-- Legacy Convex parity: QC axis, GPS metadata, import checkpoints, saved views

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum PhotoType
ALTER TYPE "PhotoType" ADD VALUE IF NOT EXISTS 'INSIDE';
ALTER TYPE "PhotoType" ADD VALUE IF NOT EXISTS 'DOCUMENT';

-- AlterTable surveys
ALTER TABLE "surveys"
  ADD COLUMN IF NOT EXISTS "sectorNo" TEXT,
  ADD COLUMN IF NOT EXISTS "constructedYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "isSlum" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "legacySurveyId" TEXT,
  ADD COLUMN IF NOT EXISTS "electricityConsumerNo" TEXT,
  ADD COLUMN IF NOT EXISTS "gpsProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "gpsMockLocation" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "qcStatus" "QcStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "serverVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "completionPct" INTEGER,
  ADD COLUMN IF NOT EXISTS "clientUpdatedAt" TIMESTAMP(3);

-- Backfill qcStatus from surveyStatus for existing rows
UPDATE "surveys"
SET "qcStatus" = CASE
  WHEN "surveyStatus" = 'APPROVED' THEN 'APPROVED'::"QcStatus"
  WHEN "surveyStatus" = 'REJECTED' THEN 'REJECTED'::"QcStatus"
  WHEN "surveyStatus" = 'SUBMITTED' THEN 'PENDING'::"QcStatus"
  ELSE 'PENDING'::"QcStatus"
END
WHERE TRUE;

CREATE INDEX IF NOT EXISTS "surveys_ulbId_qcStatus_idx" ON "surveys"("ulbId", "qcStatus");
CREATE INDEX IF NOT EXISTS "surveys_wardId_qcStatus_idx" ON "surveys"("wardId", "qcStatus");
CREATE INDEX IF NOT EXISTS "surveys_qcStatus_createdAt_idx" ON "surveys"("qcStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "surveys_localId_idx" ON "surveys"("localId");
CREATE INDEX IF NOT EXISTS "surveys_legacySurveyId_idx" ON "surveys"("legacySurveyId");

-- AlterTable co_owners
ALTER TABLE "co_owners" ADD COLUMN IF NOT EXISTS "ownerIndex" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "co_owners_surveyId_ownerIndex_idx" ON "co_owners"("surveyId", "ownerIndex");

-- AlterTable floors
ALTER TABLE "floors"
  ADD COLUMN IF NOT EXISTS "clientFloorId" TEXT,
  ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "floors_surveyId_clientFloorId_idx" ON "floors"("surveyId", "clientFloorId");

-- AlterTable photos
ALTER TABLE "photos"
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "importStatus" TEXT;
CREATE INDEX IF NOT EXISTS "photos_importStatus_idx" ON "photos"("importStatus");

-- CreateTable qc_remarks
CREATE TABLE IF NOT EXISTS "qc_remarks" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qc_remarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "qc_remarks_surveyId_createdAt_idx" ON "qc_remarks"("surveyId", "createdAt");
CREATE INDEX IF NOT EXISTS "qc_remarks_authorId_idx" ON "qc_remarks"("authorId");

ALTER TABLE "qc_remarks"
  DROP CONSTRAINT IF EXISTS "qc_remarks_surveyId_fkey",
  ADD CONSTRAINT "qc_remarks_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "qc_remarks"
  DROP CONSTRAINT IF EXISTS "qc_remarks_authorId_fkey",
  ADD CONSTRAINT "qc_remarks_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable import_jobs
ALTER TABLE "import_jobs"
  ADD COLUMN IF NOT EXISTS "processedRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "photoSuccessCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "photoFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "checkpoint" JSONB,
  ADD COLUMN IF NOT EXISTS "resumeToken" TEXT;

-- AlterTable export_jobs
ALTER TABLE "export_jobs"
  ADD COLUMN IF NOT EXISTS "filename" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "export_jobs_reportType_createdAt_idx" ON "export_jobs"("reportType", "createdAt");

-- CreateTable saved_views
CREATE TABLE IF NOT EXISTS "saved_views" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "entity" TEXT NOT NULL DEFAULT 'surveys',
  "filters" JSONB NOT NULL,
  "columns" JSONB,
  "sortBy" TEXT,
  "sortOrder" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_views_userId_entity_name_key" ON "saved_views"("userId", "entity", "name");
CREATE INDEX IF NOT EXISTS "saved_views_userId_entity_idx" ON "saved_views"("userId", "entity");

ALTER TABLE "saved_views"
  DROP CONSTRAINT IF EXISTS "saved_views_userId_fkey",
  ADD CONSTRAINT "saved_views_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
