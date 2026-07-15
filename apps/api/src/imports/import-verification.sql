-- Survey import / ULB master diagnostics
-- Table is "ulbs" (plural), column is "code" — NOT "ulb" / "ulb_code".

-- 1) How many ULBs exist?
SELECT COUNT(*) AS ulb_count FROM ulbs;

-- 2) Does the failing import code exist?
SELECT id, code, name, "districtId", type
FROM ulbs
WHERE code = '800726';

-- 3) All ULB codes currently seeded
SELECT code, name
FROM ulbs
ORDER BY code;

-- 4) Column inventory (confirm field name)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ulbs'
ORDER BY ordinal_position;

-- 5) Ward under ULB 800726 (any padding form)
SELECT w.id, w."wardNumber", w."wardName", u.code AS ulb_code
FROM wards w
JOIN ulbs u ON u.id = w."ulbId"
WHERE u.code = '800726'
  AND w."wardNumber" IN ('05', '5', '005');

-- 6) Duplicate property IDs already in DB
-- Unique constraint is (ulbId, propertyId, assessmentYear)
SELECT "propertyId", "ulbId", "assessmentYear", COUNT(*)
FROM surveys
WHERE "deletedAt" IS NULL
GROUP BY "propertyId", "ulbId", "assessmentYear"
HAVING COUNT(*) > 1;
