-- Additive: structured QC correction items (section / field / reason) on existing remarks.
-- Nullable columns only; existing rows and writers are unaffected.
ALTER TABLE "qc_remarks"
  ADD COLUMN IF NOT EXISTS "section" TEXT,
  ADD COLUMN IF NOT EXISTS "field" TEXT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- Open-remark lookups on resubmit (WHERE "surveyId" = ? AND "resolvedAt" IS NULL).
CREATE INDEX IF NOT EXISTS "qc_remarks_surveyId_resolvedAt_idx" ON "qc_remarks"("surveyId", "resolvedAt");
