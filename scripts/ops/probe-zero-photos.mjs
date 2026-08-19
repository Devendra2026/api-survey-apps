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
const prodPath = resolve(root, ".env.production")
const prod = {}
if (existsSync(prodPath)) {
  for (const line of readFileSync(prodPath, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#") || !t.includes("=")) continue
    const i = t.indexOf("=")
    prod[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")
  }
}
const siteUrl = (prod.CONVEX_SITE_URL || "").replace(/\/+$/, "")
const secret = (prod.ETL_CONVEX_SECRET || "").trim()

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: "25fc54",
    runId: "zero-photo",
    hypothesisId,
    location: "probe-zero-photos.mjs",
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 })
await client.connect()

const rows = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId", s."wardNumber", s."ulbCode",
         s."surveyStatus"::text, s."qcStatus"::text, s."createdAt",
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected", ms."lastError"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."ulbCode" = '801262' AND s."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id)
  ORDER BY s."wardNumber", s."parcelNumber"
`)

const completedZero = await client.query(`
  SELECT ms."legacySurveyId", ms.status::text, ms."imagesImported", ms."imagesExpected",
         ms."surveyId", ms."lastError", s."parcelNumber", s."wardNumber", s."propertyId"
  FROM migration_state ms
  LEFT JOIN surveys s ON s.id = ms."surveyId" OR s."legacySurveyId" = ms."legacySurveyId"
  WHERE ms.status = 'COMPLETED' AND ms."imagesImported" = 0
`)

await client.end()

const ids = rows.rows.map((r) => r.legacySurveyId).filter(Boolean)
const convexById = new Map()
if (ids.length > 0) {
  const res = await fetch(`${siteUrl}/etl/get-survey-bundles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ETL-Secret": secret },
    body: JSON.stringify({ ids }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text.slice(0, 300))
  for (const b of JSON.parse(text).bundles || []) {
    convexById.set(b._id, {
      parcelNo: b.parcelNo,
      wardNo: b.wardNo,
      propertyId: b.propertyId ?? null,
      status: b.status,
      photoCount: (b.photos || []).length,
      urlCount: (b.photos || []).filter((p) => p.url).length,
      slots: (b.photos || []).map((p) => p.slot),
    })
  }
}

const require = createRequire(resolve(root, "apps/api/package.json"))
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3")
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
})

const compared = []
for (const nest of rows.rows) {
  const convex = nest.legacySurveyId ? convexById.get(nest.legacySurveyId) : null
  const expectedKey = nest.legacySurveyId
    ? `etah-images/district-ETA/ward-${String(nest.wardNumber || "").replace(/^0+/, "")}/${nest.legacySurveyId}/front.jpg`
    : null
  let minio = null
  if (expectedKey) {
    try {
      const out = await s3.send(new HeadObjectCommand({ Bucket: "api-survey-app", Key: expectedKey }))
      minio = { exists: true, size: out.ContentLength, key: expectedKey }
    } catch (err) {
      minio = { exists: false, status: err?.$metadata?.httpStatusCode ?? err?.name, key: expectedKey }
    }
  }
  compared.push({
    nestId: nest.id,
    legacySurveyId: nest.legacySurveyId,
    parcelNumber: nest.parcelNumber,
    wardNumber: nest.wardNumber,
    propertyId: nest.propertyId,
    mig_status: nest.mig_status,
    imagesImported: nest.imagesImported,
    imagesExpected: nest.imagesExpected,
    lastError: nest.lastError,
    convex,
    minio,
    category:
      convex && convex.urlCount > 0 && minio && minio.exists === false
        ? "A_missing_pg_and_minio"
        : convex && convex.urlCount > 0 && minio && minio.exists === true
          ? "C_or_A_minio_present_pg_missing"
          : convex && convex.urlCount === 0
            ? "D_convex_no_url"
            : "unknown",
  })
}

const out = { etahNoPhotos: compared, completedZero: completedZero.rows }
log("A", "Etah surveys with zero Nest photos", {
  count: compared.length,
  categories: compared.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1
    return acc
  }, {}),
  rows: compared,
  completedZero: completedZero.rows,
})
console.log(JSON.stringify(out, null, 2))
