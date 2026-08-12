-- Step 2: remap FIFTH_FLOOR_PLUS → FIFTH_FLOOR, drop old enum value, backfill built-up.
-- Idempotent / retry-safe after the 2026-08-04 production failure that used wrong
-- table names ("Floor"/"Survey"). That attempt failed before mutating data; resolve
-- --rolled-back then re-deploy applies this fixed SQL.

-- Drop unused orphan from a partial create (never drop if floors already uses it).
DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FloorPosition_new')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       JOIN pg_namespace n ON c.relnamespace = n.oid
       JOIN pg_type t ON a.atttypid = t.oid
       WHERE n.nspname = 'public'
         AND c.relname = 'floors'
         AND a.attname = 'floorPosition'
         AND NOT a.attisdropped
         AND t.typname = 'FloorPosition_new'
     )
  THEN
    DROP TYPE "FloorPosition_new";
  END IF;
END
$cleanup$;

DO $remap$
BEGIN
  -- Already remapped: nothing to do.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'FloorPosition'
      AND e.enumlabel = 'FIFTH_FLOOR_PLUS'
  ) THEN
    RETURN;
  END IF;

  -- Finish a partial run where the column already points at FloorPosition_new.
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'floors'
      AND a.attname = 'floorPosition'
      AND NOT a.attisdropped
      AND t.typname = 'FloorPosition_new'
  ) THEN
    DROP TYPE IF EXISTS "FloorPosition";
    ALTER TYPE "FloorPosition_new" RENAME TO "FloorPosition";
    RETURN;
  END IF;

  UPDATE "floors"
  SET "floorPosition" = 'FIFTH_FLOOR'
  WHERE "floorPosition"::text = 'FIFTH_FLOOR_PLUS';

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

  ALTER TABLE "floors"
    ALTER COLUMN "floorPosition" TYPE "FloorPosition_new"
    USING ("floorPosition"::text::"FloorPosition_new");

  DROP TYPE "FloorPosition";
  ALTER TYPE "FloorPosition_new" RENAME TO "FloorPosition";
END
$remap$;

-- Backfill built-up from countable floor rows (exclude OPEN_LAND position/usage).
-- Open-land property use → 0. Safe to re-run.
UPDATE "surveys" s
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
        WHEN f."floorPosition"::text = 'OPEN_LAND' OR f."usageFactor"::text = 'OPEN_LAND' THEN 0
        ELSE COALESCE(f."areaSqFt", 0)
      END
    ) AS built_sq_ft
  FROM "floors" f
  GROUP BY f."surveyId"
) agg
WHERE s.id = agg.survey_id;

-- Surveys with open land: force built-up to 0.
UPDATE "surveys"
SET
  "totalBuiltAreaSqFt" = 0,
  "totalBuiltAreaSqMeter" = 0
WHERE "propertyUse" = 'OPEN_LAND';
