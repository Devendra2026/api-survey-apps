SELECT COUNT(*) FILTER (WHERE "assessmentYear" IS NULL) AS null_ay, COUNT(*) AS total FROM surveys;
SELECT "propertyId", "ulbId", "assessmentYear"::text FROM surveys;
