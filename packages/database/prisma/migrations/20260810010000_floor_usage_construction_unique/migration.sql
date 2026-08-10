-- Allow same floor + same usage with different construction (e.g. Residential Pakka + Tin Shed).
-- Unique identity becomes (surveyId, floorPosition, usageFactor, constructionType).

-- Backfill null construction before NOT NULL + new unique.
UPDATE "floors"
SET "constructionType" = 'PAKKA_BUILDING_WITH_RCC_ROOF'
WHERE "constructionType" IS NULL;

-- Collapse accidental duplicates on the new 4-key (keep oldest row).
DELETE FROM "floors" a
USING "floors" b
WHERE a."surveyId" = b."surveyId"
  AND a."floorPosition" = b."floorPosition"
  AND a."usageFactor" = b."usageFactor"
  AND a."constructionType" = b."constructionType"
  AND a."createdAt" > b."createdAt";

DROP INDEX IF EXISTS "floors_surveyId_floorPosition_usageFactor_key";

ALTER TABLE "floors" ALTER COLUMN "constructionType" SET NOT NULL;

CREATE UNIQUE INDEX "floors_surveyId_floorPosition_usageFactor_constructionType_key"
  ON "floors"("surveyId", "floorPosition", "usageFactor", "constructionType");
