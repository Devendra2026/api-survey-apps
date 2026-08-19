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
    runId: "key-variants",
    hypothesisId,
    location: "probe-key-variants.mjs",
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

const ids = [
  "k975myrav11zpxaz828eg3fr1s88gn04",
  "k975csv0sk9at1bm2sm9vp1cxn8b5nyb",
  "k977ecv7h1h4rrh8tgpc3xav5h8axx3j",
  "k970djzvy9cbnxewwdc36d9yj98bg13r",
  "k975s0a9rhftm537r6b77v88sx8bhv66",
]

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
await client.connect()
const photos = await client.query(
  `SELECT id, "surveyId", "photoType"::text, "objectKey", bucket, "importStatus", "sizeBytes", left(url, 80) AS url
   FROM photos WHERE "objectKey" LIKE ANY($1) OR url LIKE ANY($1)`,
  [ids.map((id) => `%${id}%`)]
)
const working = await client.query(`
  SELECT p."objectKey", p."sizeBytes", s."legacySurveyId", s."wardNumber", s."parcelNumber"
  FROM photos p JOIN surveys s ON s.id = p."surveyId"
  WHERE s."ulbCode" = '801262' AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '1'
    AND p."objectKey" IS NOT NULL
  LIMIT 8
`)
await client.end()

const require = createRequire(resolve(root, "apps/api/package.json"))
const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3")
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
})

async function head(Key) {
  try {
    const out = await s3.send(new HeadObjectCommand({ Bucket: "api-survey-app", Key }))
    return { Key, exists: true, size: out.ContentLength }
  } catch (err) {
    return { Key, exists: false, status: err?.$metadata?.httpStatusCode ?? err?.name }
  }
}

const prefixes = ids.map((id) => `etah-images/`)
const listed = []
for (const id of ids) {
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: "api-survey-app", Prefix: `etah-images/`, MaxKeys: 1 })
  )
  void res
  const byId = await s3.send(
    new ListObjectsV2Command({
      Bucket: "api-survey-app",
      Prefix: "",
      MaxKeys: 20,
    })
  )
  void byId
}

const variantKeys = []
for (const id of ["k975csv0sk9at1bm2sm9vp1cxn8b5nyb", "k977ecv7h1h4rrh8tgpc3xav5h8axx3j", "k975myrav11zpxaz828eg3fr1s88gn04"]) {
  for (const dist of ["ETA", "Etah"]) {
    for (const ward of ["1", "01", "3", "03"]) {
      for (const slot of ["front", "side"]) {
        for (const ext of ["jpg", "webp"]) {
          variantKeys.push(`etah-images/district-${dist}/ward-${ward}/${id}/${slot}.${ext}`)
        }
      }
    }
  }
}

const heads = []
for (const Key of variantKeys) {
  const h = await head(Key)
  if (h.exists) heads.push(h)
}

const lists = {}
for (const id of ids) {
  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: "api-survey-app",
      Prefix: `etah-images/district-ETA/`,
      MaxKeys: 1000,
    })
  )
  lists[id] = (res.Contents || []).map((o) => o.Key).filter((k) => k.includes(id))
}

const out = {
  photosForLegacyIds: photos.rows,
  workingWard1Keys: working.rows,
  existingVariantHeads: heads,
  minioKeysContainingIds: lists,
}
log("C", "Object key variants and leftover photo rows", {
  photoRowCount: photos.rows.length,
  workingWard1Sample: working.rows.map((r) => r.objectKey),
  existingVariantCount: heads.length,
  minioKeysContainingIds: lists,
})
console.log(JSON.stringify(out, null, 2))
