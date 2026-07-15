-- Ensure ULB codes are globally unique (LGD / municipality codes).
-- Deduplicate any colliding codes by suffixing older rows before adding the constraint.

WITH ranked AS (
  SELECT
    id,
    code,
    ROW_NUMBER() OVER (PARTITION BY code ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "ulbs"
)
UPDATE "ulbs" u
SET code = u.code || '-dup-' || LEFT(u.id, 8)
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS "ulbs_code_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "ulbs_code_key" ON "ulbs"("code");
