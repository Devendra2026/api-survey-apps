-- Seed wards 01-50 (and unpadded) for production LGD ULBs used by ETL.
INSERT INTO wards (id, "ulbId", "wardNumber", "wardName", status, "createdAt", "updatedAt")
SELECT
  'clocalw801262p' || lpad(gs::text, 8, '0'),
  u.id,
  lpad(gs::text, 2, '0'),
  'Ward ' || lpad(gs::text, 2, '0'),
  'ACTIVE',
  NOW(),
  NOW()
FROM ulbs u
CROSS JOIN generate_series(1, 50) AS gs
WHERE u.code = '801262'
  AND NOT EXISTS (
    SELECT 1 FROM wards x WHERE x."ulbId" = u.id AND x."wardNumber" = lpad(gs::text, 2, '0')
  );

INSERT INTO wards (id, "ulbId", "wardNumber", "wardName", status, "createdAt", "updatedAt")
SELECT
  'clocalw800726p' || lpad(gs::text, 8, '0'),
  u.id,
  lpad(gs::text, 2, '0'),
  'Ward ' || lpad(gs::text, 2, '0'),
  'ACTIVE',
  NOW(),
  NOW()
FROM ulbs u
CROSS JOIN generate_series(1, 50) AS gs
WHERE u.code = '800726'
  AND NOT EXISTS (
    SELECT 1 FROM wards x WHERE x."ulbId" = u.id AND x."wardNumber" = lpad(gs::text, 2, '0')
  );

-- Reset failed rows so retry can reprocess them
UPDATE migration_state
SET status = 'PENDING', "retryCount" = 0, "lastError" = NULL, "updatedAt" = NOW()
WHERE status IN ('FAILED', 'IN_PROGRESS');

UPDATE failed_imports
SET "retryCount" = 0, "resolvedAt" = NULL
WHERE "resolvedAt" IS NULL OR "resolvedAt" IS NOT NULL;

UPDATE failed_imports
SET "resolvedAt" = NULL, "retryCount" = 0;

-- Stop stuck RUNNING full job so a new force run can start
UPDATE migration_jobs
SET status = 'FAILED', "finishedAt" = NOW(), "updatedAt" = NOW()
WHERE status IN ('RUNNING', 'QUEUED');

SELECT u.code, count(w.*) AS wards FROM ulbs u
LEFT JOIN wards w ON w."ulbId" = u.id
WHERE u.code IN ('801262','800726')
GROUP BY 1;

SELECT status, count(*) FROM migration_state GROUP BY 1 ORDER BY 1;
