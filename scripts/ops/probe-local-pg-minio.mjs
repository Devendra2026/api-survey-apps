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
    runId: "local-db-probe",
    hypothesisId,
    location: "probe-local-pg-minio.mjs",
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
const counts = await client.query(`
  SELECT
    (SELECT COUNT(*)::int FROM surveys) AS surveys,
    (SELECT COUNT(*)::int FROM photos) AS photos,
    (SELECT COUNT(*)::int FROM migration_state) AS migration_states,
    (SELECT COUNT(*)::int FROM surveys WHERE "legacySurveyId" IS NOT NULL) AS with_legacy,
    (SELECT COUNT(*)::int FROM surveys WHERE "ulbCode" = '801262') AS etah,
    (SELECT COUNT(*)::int FROM surveys WHERE "propertyId" IN ('801262-012-00305-001-R','801262-012-00304-001-R')) AS ref_parcels
`)
const sample = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId", s."wardNumber", s."ulbCode",
         (SELECT COUNT(*)::int FROM photos p WHERE p."surveyId" = s.id) AS photo_count
  FROM surveys s
  WHERE s."deletedAt" IS NULL
  ORDER BY s."createdAt" DESC NULLS LAST
  LIMIT 5
`)
await client.end()

const require = createRequire(resolve(root, "apps/api/package.json"))
let minio = { ok: false }
try {
  const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3")
  const s3 = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER,
      secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD,
    },
  })
  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.MINIO_BUCKET || "api-survey-app",
    Prefix: "etah-images/",
    MaxKeys: 10,
  }))
  minio = {
    ok: true,
    keyCount: listed.KeyCount ?? listed.Contents?.length ?? 0,
    sampleKeys: (listed.Contents || []).map((o) => o.Key).slice(0, 5),
  }
} catch (err) {
  minio = { ok: false, error: err instanceof Error ? err.message : String(err) }
}

const out = { counts: counts.rows[0], sample: sample.rows, minio }
log("A", "Local Postgres/MinIO inventory", out)
console.log(JSON.stringify(out, null, 2))
