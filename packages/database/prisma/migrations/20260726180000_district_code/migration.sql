-- Add required District.code (3-letter A–Z), unique per state.
-- Idempotent: safe if column / values already partially applied.

ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "code" TEXT;

UPDATE "districts"
SET "code" = UPPER(LEFT(REGEXP_REPLACE(COALESCE("name", ''), '[^A-Za-z]', '', 'g') || 'XXX', 3))
WHERE "code" IS NULL OR TRIM("code") = '';

-- Resolve duplicate (stateId, code): keep first row; reassign others AAA, AAB, …
WITH ranked AS (
  SELECT
    id,
    "stateId",
    "code" AS base_code,
    ROW_NUMBER() OVER (
      PARTITION BY "stateId", "code"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "districts"
),
assigned AS (
  SELECT
    id,
    CASE
      WHEN rn = 1 THEN base_code
      ELSE
        CHR((65 + (((rn - 2) / 676) % 26))::integer)
        || CHR((65 + (((rn - 2) / 26) % 26))::integer)
        || CHR((65 + ((rn - 2) % 26))::integer)
    END AS final_code
  FROM ranked
)
UPDATE "districts" d
SET "code" = a.final_code
FROM assigned a
WHERE d.id = a.id
  AND d."code" IS DISTINCT FROM a.final_code;

-- Any remaining collisions (rare): force unique from id letters.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "stateId", "code"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "districts"
)
UPDATE "districts" d
SET "code" = UPPER(LEFT(REGEXP_REPLACE(LEFT(d.id, 12), '[^A-Za-z]', 'X', 'g') || 'XXX', 3))
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

ALTER TABLE "districts" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "districts_stateId_code_key" ON "districts"("stateId", "code");
