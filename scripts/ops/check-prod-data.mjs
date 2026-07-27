import pg from "../../packages/database/node_modules/pg/lib/index.js"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DB_ERROR DATABASE_URL missing")
  process.exit(2)
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
})

await client.connect()

const tables = await client.query(`
  SELECT to_regclass('public."Survey"') AS survey,
         to_regclass('public."Photo"') AS photo,
         to_regclass('public."MigrationJob"') AS mig
`)
console.log("tables", JSON.stringify(tables.rows[0]))

const surveyExists = tables.rows[0]?.survey
if (!surveyExists) {
  console.log("counts", JSON.stringify({ surveys: 0, note: "schema_not_migrated" }))
  const rels = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LIMIT 50
  `)
  console.log("public_tables", JSON.stringify(rels.rows.map((r) => r.tablename)))
  await client.end()
  process.exit(0)
}

const counts = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM "Survey") AS surveys,
    (SELECT COUNT(*)::int FROM "Photo") AS photos,
    (SELECT COUNT(*)::int FROM "Photo" WHERE "objectKey" IS NOT NULL AND "objectKey" <> '') AS photos_with_key,
    (SELECT COUNT(*)::int FROM "Photo" WHERE "objectKey" LIKE 'etah-images/%') AS etl_photos,
    (SELECT COUNT(*)::int FROM "Photo" WHERE "objectKey" LIKE 'uploads/%') AS upload_photos,
    (SELECT COUNT(*)::int FROM "Ulb") AS ulbs,
    (SELECT COUNT(*)::int FROM "Ward") AS wards,
    (SELECT COUNT(*)::int FROM "MigrationJob") AS migration_jobs,
    (SELECT COUNT(*)::int FROM "MigrationState") AS migration_states
`)
console.log("counts", JSON.stringify(counts.rows[0]))

const sampleKeys = await client.query(`
  SELECT "objectKey", "bucket", "storageProvider"::text AS provider
  FROM "Photo"
  WHERE "objectKey" IS NOT NULL AND "objectKey" <> ''
  ORDER BY "createdAt" DESC NULLS LAST
  LIMIT 10
`)
console.log("sample_keys", JSON.stringify(sampleKeys.rows))

const geo = await client.query(`
  SELECT d.code AS district_code, u.code AS ulb_code, w."wardNumber", COUNT(s.id)::int AS survey_count
  FROM "Survey" s
  JOIN "Ward" w ON w.id = s."wardId"
  JOIN "Ulb" u ON u.id = s."ulbId"
  JOIN "District" d ON d.id = s."districtId"
  GROUP BY 1,2,3
  ORDER BY survey_count DESC
  LIMIT 15
`)
console.log("geo_dist", JSON.stringify(geo.rows))

await client.end()
