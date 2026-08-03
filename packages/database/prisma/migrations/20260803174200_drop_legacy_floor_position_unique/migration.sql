-- Legacy unique was CREATE UNIQUE INDEX (not a table constraint).
-- 20260801170000 used DROP CONSTRAINT IF EXISTS (no-op on PostgreSQL),
-- leaving floors_surveyId_floorPosition_key and blocking mixed-use inserts.
DROP INDEX IF EXISTS "floors_surveyId_floorPosition_key";

-- Idempotent: ensure mixed-use unique exists
CREATE UNIQUE INDEX IF NOT EXISTS "floors_surveyId_floorPosition_usageFactor_key"
  ON "floors"("surveyId", "floorPosition", "usageFactor");
