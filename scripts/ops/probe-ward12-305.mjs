#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const root = resolve(import.meta.dirname, "../..")
const workspaceLog = resolve("c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log")

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#") || !t.includes("=")) continue
    const i = t.indexOf("=")
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")
    if (process.env[k] === undefined) process.env[k] = v
  }
}
loadEnv(resolve(root, ".env.development"))
loadEnv(resolve(root, "packages/database/.env"))

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: "25fc54",
    runId: "local-compare",
    hypothesisId,
    location: "probe-ward12-305.mjs",
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  fetch("http://127.0.0.1:7681/ingest/0fc9f6c6-0c15-443b-bd77-d3106250dbc1", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "25fc54" },
    body: JSON.stringify(payload),
  }).catch(() => { })
  appendFileSync(workspaceLog, `${JSON.stringify(payload)}\n`)
  // #endregion
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
await client.connect()

const ids = ["k970djzvy9cbnxewwdc36d9yj98bg13r", "k975s0a9rhftm537r6b77v88sx8bhv66"]

const byLegacy = await client.query(
  `
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId", s."wardNumber", s."wardId",
         s."ulbCode", s."surveyStatus"::text, s."qcStatus"::text,
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected", ms."lastError"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."legacySurveyId" = ANY($1)
  `,
  [ids]
)

const migOnly = await client.query(
  `SELECT "legacySurveyId", status::text, "imagesImported", "imagesExpected", "surveyId", "lastError"
   FROM migration_state WHERE "legacySurveyId" = ANY($1)`,
  [ids]
)

const byParcel = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId", s."wardNumber", s."wardId",
         s."ulbCode", s."surveyStatus"::text, s."qcStatus"::text,
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected",
         p.id AS photo_id, p."photoType"::text, p."objectKey", p.bucket, p."importStatus", p."sizeBytes"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  LEFT JOIN photos p ON p."surveyId" = s.id
  WHERE s."ulbCode" = '801262'
    AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '12'
    AND regexp_replace(coalesce(s."parcelNumber",''), '^0+', '') IN ('304','305')
    AND s."deletedAt" IS NULL
  ORDER BY s."parcelNumber", s.id, p."photoType"
`)

const ward12 = await client.query(`
  SELECT
    COUNT(*)::int AS surveys,
    COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id))::int AS surveys_no_photos,
    COUNT(*) FILTER (
      WHERE ms.status = 'COMPLETED' AND COALESCE(ms."imagesImported",0) = 0
        AND NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id)
    )::int AS completed_zero_images
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."ulbCode" = '801262'
    AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '12'
    AND s."deletedAt" IS NULL
`)

const zeroPhotoSamples = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId",
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."ulbCode" = '801262'
    AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '12'
    AND s."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id)
  ORDER BY s."parcelNumber"
  LIMIT 25
`)

const neighbors = await client.query(`
  SELECT s."parcelNumber", s."legacySurveyId", s."propertyId",
         (SELECT COUNT(*)::int FROM photos p WHERE p."surveyId" = s.id) AS photo_count,
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."ulbCode" = '801262'
    AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '12'
    AND regexp_replace(coalesce(s."parcelNumber",''), '^0+', '') IN ('300','301','304','305','306','307','310')
    AND s."deletedAt" IS NULL
  ORDER BY s."parcelNumber"
`)

await client.end()

const require = createRequire(resolve(root, "apps/api/package.json"))
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3")
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
})
const bucket = process.env.MINIO_BUCKET || "api-survey-app"
const keys = [
  "etah-images/district-ETA/ward-12/k970djzvy9cbnxewwdc36d9yj98bg13r/front.jpg",
  "etah-images/district-ETA/ward-12/k970djzvy9cbnxewwdc36d9yj98bg13r/side.jpg",
  "etah-images/district-ETA/ward-12/k975s0a9rhftm537r6b77v88sx8bhv66/front.jpg",
  "etah-images/district-ETA/ward-12/k975s0a9rhftm537r6b77v88sx8bhv66/side.jpg",
]
const heads = []
for (const Key of keys) {
  try {
    const out = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key }))
    heads.push({ Key, exists: true, size: out.ContentLength, contentType: out.ContentType })
  } catch (err) {
    heads.push({ Key, exists: false, status: err?.$metadata?.httpStatusCode ?? err?.name })
  }
}

const out = {
  byLegacy: byLegacy.rows,
  migOnly: migOnly.rows,
  byParcel: byParcel.rows,
  ward12: ward12.rows[0],
  zeroPhotoSamples: zeroPhotoSamples.rows,
  neighbors: neighbors.rows,
  minioHeads: heads,
}
log("A", "Ward 12 parcel 304/305 Nest+MinIO compare", {
  byLegacyCount: byLegacy.rows.length,
  migOnly,
  byParcelCount: byParcel.rows.length,
  ward12: ward12.rows[0],
  zeroPhotoCount: zeroPhotoSamples.rows.length,
  neighbors: neighbors.rows,
  minioHeads: heads,
})
console.log(JSON.stringify(out, null, 2))
