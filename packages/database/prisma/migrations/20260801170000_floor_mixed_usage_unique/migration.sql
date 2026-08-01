-- Allow mixed-use: multiple Floor rows per survey+floorPosition with different usageFactor.
-- Backfill null usageFactor before enforcing NOT NULL + new unique.

UPDATE "floors"
SET "usageFactor" = 'RESIDENTIAL'
WHERE "usageFactor" IS NULL;

-- Collapse any accidental duplicate (surveyId, floorPosition, usageFactor) by keeping the oldest row.
DELETE FROM "floors" a
USING "floors" b
WHERE a."surveyId" = b."surveyId"
  AND a."floorPosition" = b."floorPosition"
  AND a."usageFactor" = b."usageFactor"
  AND a."createdAt" > b."createdAt";

ALTER TABLE "floors" DROP CONSTRAINT IF EXISTS "floors_surveyId_floorPosition_key";

ALTER TABLE "floors" ALTER COLUMN "usageFactor" SET NOT NULL;

CREATE UNIQUE INDEX "floors_surveyId_floorPosition_usageFactor_key"
  ON "floors"("surveyId", "floorPosition", "usageFactor");
