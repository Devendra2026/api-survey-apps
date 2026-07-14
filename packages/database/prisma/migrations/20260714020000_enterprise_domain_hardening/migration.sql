-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('S3', 'MINIO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "GpsSource" AS ENUM ('DEVICE', 'MANUAL', 'IMPORT');

-- DropForeignKey
ALTER TABLE "survey_audits" DROP CONSTRAINT "survey_audits_surveyId_fkey";

-- DropIndex
DROP INDEX "floors_surveyId_floorPosition_idx";

-- DropIndex
DROP INDEX "surveys_propertyId_key";

-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "etag" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "objectKey" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageProvider" "StorageProvider";

-- AlterTable
ALTER TABLE "surveys" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "gpsAccuracyMeters" DECIMAL(8,2),
ADD COLUMN     "gpsSource" "GpsSource",
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ALTER COLUMN "assessmentYear" SET NOT NULL;

-- AlterTable
ALTER TABLE "user_tenant_roles" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT;

-- DropEnum
DROP TYPE "UserRoles";

-- CreateTable
CREATE TABLE "security_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT,
    "storageProvider" "StorageProvider",
    "bucket" TEXT,
    "objectKey" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errorReportKey" TEXT,
    "resultSummary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "reportType" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB,
    "storageProvider" "StorageProvider",
    "bucket" TEXT,
    "objectKey" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_audits_actorId_idx" ON "security_audits"("actorId");

-- CreateIndex
CREATE INDEX "security_audits_action_idx" ON "security_audits"("action");

-- CreateIndex
CREATE INDEX "security_audits_createdAt_idx" ON "security_audits"("createdAt");

-- CreateIndex
CREATE INDEX "security_audits_targetType_targetId_idx" ON "security_audits"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "import_jobs_createdById_createdAt_idx" ON "import_jobs"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_status_createdAt_idx" ON "import_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_createdById_createdAt_idx" ON "export_jobs"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_status_createdAt_idx" ON "export_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "floors_surveyId_floorPosition_key" ON "floors"("surveyId", "floorPosition");

-- CreateIndex
CREATE INDEX "photos_objectKey_idx" ON "photos"("objectKey");

-- CreateIndex
CREATE INDEX "surveys_assignedToId_surveyStatus_idx" ON "surveys"("assignedToId", "surveyStatus");

-- CreateIndex
CREATE INDEX "surveys_propertyId_idx" ON "surveys"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_ulbId_propertyId_assessmentYear_key" ON "surveys"("ulbId", "propertyId", "assessmentYear");

-- AddForeignKey
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_deactivatedBy_fkey" FOREIGN KEY ("deactivatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_audits" ADD CONSTRAINT "survey_audits_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audits" ADD CONSTRAINT "security_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Expand: default assignment = creator for existing rows (immutable createdBy preserved)
UPDATE "surveys"
SET "assignedToId" = "createdById",
    "assignedAt" = COALESCE("assignedAt", "createdAt")
WHERE "assignedToId" IS NULL;

-- GPS coordinate range checks (additive; validated at DB layer)
ALTER TABLE "surveys" DROP CONSTRAINT IF EXISTS "surveys_latitude_range";
ALTER TABLE "surveys" DROP CONSTRAINT IF EXISTS "surveys_longitude_range";
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));

-- Active tenant-role uniqueness treating NULL scope columns as equal
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenant_roles_active_scope_unique"
ON "user_tenant_roles" (
  "userId",
  "roleId",
  COALESCE("stateId", ''),
  COALESCE("districtId", ''),
  COALESCE("ulbId", ''),
  COALESCE("wardId", '')
)
WHERE "isActive" = true;

-- Exactly one FRONT photo per survey
CREATE UNIQUE INDEX IF NOT EXISTS "photos_surveyId_front_unique"
ON "photos" ("surveyId")
WHERE "photoType" = 'FRONT';
