-- Step 2: remap FIFTH_FLOOR_PLUS → FIFTH_FLOOR, drop old enum value, backfill built-up.

UPDATE "Floor"
SET "floorPosition" = 'FIFTH_FLOOR'
WHERE "floorPosition" = 'FIFTH_FLOOR_PLUS';

CREATE TYPE "FloorPosition_new" AS ENUM (
  'BASEMENT',
  'GROUND_FLOOR',
  'FIRST_FLOOR',
  'SECOND_FLOOR',
  'THIRD_FLOOR',
  'FOURTH_FLOOR',
  'FIFTH_FLOOR',
  'SIXTH_FLOOR',
  'OPEN_LAND'
);

ALTER TABLE "Floor"
  ALTER COLUMN "floorPosition" TYPE "FloorPosition_new"
  USING ("floorPosition"::text::"FloorPosition_new");

DROP TYPE "FloorPosition";
ALTER TYPE "FloorPosition_new" RENAME TO "FloorPosition";

-- Backfill built-up from countable floor rows (exclude OPEN_LAND position/usage).
-- Open-land property use → 0.
UPDATE "Survey" s
SET
  "totalBuiltAreaSqFt" = CASE
    WHEN s."propertyUse" = 'OPEN_LAND' THEN 0
    ELSE COALESCE(agg.built_sq_ft, 0)
  END,
  "totalBuiltAreaSqMeter" = CASE
    WHEN s."propertyUse" = 'OPEN_LAND' THEN 0
    ELSE ROUND((COALESCE(agg.built_sq_ft, 0) * 0.092903)::numeric, 4)
  END
FROM (
  SELECT
    f."surveyId" AS survey_id,
    SUM(
      CASE
        WHEN f."floorPosition" = 'OPEN_LAND' OR f."usageFactor" = 'OPEN_LAND' THEN 0
        ELSE COALESCE(f."areaSqFt", 0)
      END
    ) AS built_sq_ft
  FROM "Floor" f
  GROUP BY f."surveyId"
) agg
WHERE s.id = agg.survey_id;

-- Surveys with no floors: keep existing unless open land (force 0).
UPDATE "Survey"
SET
  "totalBuiltAreaSqFt" = 0,
  "totalBuiltAreaSqMeter" = 0
WHERE "propertyUse" = 'OPEN_LAND';
