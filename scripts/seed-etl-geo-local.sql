-- Minimal local geo so production Convex LGD codes can import.
-- Codes seen in ETL failures: 801262 (ETA), 800726 (BAG).

INSERT INTO ulbs (id, "districtId", name, code, type, status, "createdAt", "updatedAt")
SELECT
  'clocalulb801262000000001',
  d.id,
  'Bakewar (LGD 801262)',
  '801262',
  'MUNICIPAL_COUNCIL',
  'ACTIVE',
  NOW(),
  NOW()
FROM districts d
WHERE d.name = 'Etah'
  AND NOT EXISTS (SELECT 1 FROM ulbs WHERE code = '801262')
LIMIT 1;

INSERT INTO ulbs (id, "districtId", name, code, type, status, "createdAt", "updatedAt")
SELECT
  'clocalulb800726000000001',
  d.id,
  'Baghpat (LGD 800726)',
  '800726',
  'MUNICIPAL_COUNCIL',
  'ACTIVE',
  NOW(),
  NOW()
FROM districts d
WHERE d.name = 'Etah'
  AND NOT EXISTS (SELECT 1 FROM ulbs WHERE code = '800726')
LIMIT 1;

INSERT INTO wards (id, "ulbId", "wardNumber", "wardName", status, "createdAt", "updatedAt")
SELECT
  'clocalward801262' || lpad(row_number() OVER ()::text, 8, '0'),
  u.id,
  w.ward_no,
  'Ward ' || w.ward_no,
  'ACTIVE',
  NOW(),
  NOW()
FROM ulbs u
CROSS JOIN (VALUES ('01'), ('1'), ('05'), ('5'), ('12')) AS w(ward_no)
WHERE u.code = '801262'
  AND NOT EXISTS (
    SELECT 1 FROM wards x WHERE x."ulbId" = u.id AND x."wardNumber" = w.ward_no
  );

INSERT INTO wards (id, "ulbId", "wardNumber", "wardName", status, "createdAt", "updatedAt")
SELECT
  'clocalward800726' || lpad(row_number() OVER ()::text, 8, '0'),
  u.id,
  w.ward_no,
  'Ward ' || w.ward_no,
  'ACTIVE',
  NOW(),
  NOW()
FROM ulbs u
CROSS JOIN (VALUES ('01'), ('1'), ('05'), ('5'), ('12')) AS w(ward_no)
WHERE u.code = '800726'
  AND NOT EXISTS (
    SELECT 1 FROM wards x WHERE x."ulbId" = u.id AND x."wardNumber" = w.ward_no
  );

SELECT u.code, count(w.id) AS wards
FROM ulbs u
LEFT JOIN wards w ON w."ulbId" = u.id
WHERE u.code IN ('801262', '800726', 'ETM')
GROUP BY u.code
ORDER BY 1;
