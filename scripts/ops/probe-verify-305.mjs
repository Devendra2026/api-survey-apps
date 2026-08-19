#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const root = resolve(import.meta.dirname, "../..")
const workspaceLog = resolve("c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log")
const legacyId = "k970djzvy9cbnxewwdc36d9yj98bg13r"

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

function log(message, data) {
  const payload = {
    sessionId: "25fc54",
    runId: "post-fix",
    hypothesisId: "E",
    location: "probe-verify-305.mjs",
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
const survey = await client.query(
  `SELECT id, "parcelNumber", "propertyId", "wardNumber", "ulbCode", "surveyStatus"::text, "qcStatus"::text
   FROM surveys WHERE "legacySurveyId" = $1 AND "deletedAt" IS NULL`,
  [legacyId]
)
const photos = await client.query(
  `SELECT p.id, p."photoType"::text, p."objectKey", p."sizeBytes", p."importStatus", p."mimeType"
   FROM photos p JOIN surveys s ON s.id = p."surveyId"
   WHERE s."legacySurveyId" = $1 ORDER BY p."photoType"`,
  [legacyId]
)
await client.end()

const require = createRequire(resolve(root, "apps/api/package.json"))
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || "minioadmin",
  },
})
const bucket = process.env.MINIO_BUCKET || process.env.STORAGE_BUCKET || "api-survey-app"

const objects = []
for (const p of photos.rows) {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: p.objectKey }))
    const buf = Buffer.from(await out.Body.transformToByteArray())
    objects.push({
      photoId: p.id,
      objectKey: p.objectKey,
      ok: true,
      bytes: buf.length,
      magic: buf.subarray(0, 3).toString("hex"),
      contentType: out.ContentType ?? null,
    })
  } catch (err) {
    objects.push({
      photoId: p.id,
      objectKey: p.objectKey,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

const result = {
  survey: survey.rows[0] ?? null,
  photoCount: photos.rows.length,
  photos: photos.rows,
  objects,
}
log("Post-apply 00305 survey + MinIO objects", result)
console.log(JSON.stringify(result, null, 2))
