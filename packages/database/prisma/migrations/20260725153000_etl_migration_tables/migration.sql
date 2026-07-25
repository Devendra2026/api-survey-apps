-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "MigrationJobType" AS ENUM ('FULL', 'INCREMENTAL', 'RETRY_FAILED', 'VALIDATE');

-- AlterTable: unique legacySurveyId (nullable unique allows multiple NULLs)
DROP INDEX IF EXISTS "surveys_legacySurveyId_idx";
CREATE UNIQUE INDEX "surveys_legacySurveyId_key" ON "surveys"("legacySurveyId");

-- CreateTable
CREATE TABLE "migration_state" (
    "id" TEXT NOT NULL,
    "legacySurveyId" TEXT NOT NULL,
    "surveyId" TEXT,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "imagesImported" INTEGER NOT NULL DEFAULT 0,
    "imagesExpected" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "lastError" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" TEXT NOT NULL,
    "type" "MigrationJobType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "batchSize" INTEGER NOT NULL DEFAULT 100,
    "cursor" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "statsJson" JSONB,
    "createdById" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "legacySurveyId" TEXT,
    "correlationId" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_imports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "legacySurveyId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "payloadJson" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "migration_state_legacySurveyId_key" ON "migration_state"("legacySurveyId");
CREATE INDEX "migration_state_status_updatedAt_idx" ON "migration_state"("status", "updatedAt");
CREATE INDEX "migration_state_surveyId_idx" ON "migration_state"("surveyId");

CREATE INDEX "migration_jobs_status_createdAt_idx" ON "migration_jobs"("status", "createdAt");
CREATE INDEX "migration_jobs_type_createdAt_idx" ON "migration_jobs"("type", "createdAt");
CREATE INDEX "migration_jobs_correlationId_idx" ON "migration_jobs"("correlationId");

CREATE INDEX "migration_logs_jobId_createdAt_idx" ON "migration_logs"("jobId", "createdAt");
CREATE INDEX "migration_logs_legacySurveyId_idx" ON "migration_logs"("legacySurveyId");

CREATE UNIQUE INDEX "failed_imports_jobId_legacySurveyId_stage_key" ON "failed_imports"("jobId", "legacySurveyId", "stage");
CREATE INDEX "failed_imports_legacySurveyId_idx" ON "failed_imports"("legacySurveyId");
CREATE INDEX "failed_imports_resolvedAt_idx" ON "failed_imports"("resolvedAt");

-- AddForeignKey
ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "failed_imports" ADD CONSTRAINT "failed_imports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
