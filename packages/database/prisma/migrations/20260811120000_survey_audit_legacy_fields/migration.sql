-- AlterTable
ALTER TABLE "survey_audits" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "survey_audits" ADD COLUMN IF NOT EXISTS "sourceEventId" TEXT;
ALTER TABLE "survey_audits" ADD COLUMN IF NOT EXISTS "actorDisplayName" TEXT;
ALTER TABLE "survey_audits" ADD COLUMN IF NOT EXISTS "actorRole" TEXT;
ALTER TABLE "survey_audits" ADD COLUMN IF NOT EXISTS "details" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "survey_audits_sourceEventId_key" ON "survey_audits"("sourceEventId");

CREATE INDEX IF NOT EXISTS "audit_events_resourceId_occurredAt_idx" ON "audit_events"("resourceId", "occurredAt");
