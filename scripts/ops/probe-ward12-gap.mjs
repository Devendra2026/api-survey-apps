#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs"
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
const prod = (() => {
  const p = resolve(root, ".env.production")
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#") || !t.includes("=")) continue
    const i = t.indexOf("=")
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")
  }
  return out
})()
const siteUrl = (prod.CONVEX_SITE_URL || process.env.CONVEX_SITE_URL || "").replace(/\/+$/, "")
const secret = (prod.ETL_CONVEX_SECRET || process.env.ETL_CONVEX_SECRET || "").trim()

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: "25fc54",
    runId: "ward12-gap",
    hypothesisId,
    location: "probe-ward12-gap.mjs",
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

function bare(v) {
  return String(v ?? "").trim().replace(/^0+/, "") || "0"
}

async function post(path, body) {
  const res = await fetch(`${siteUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ETL-Secret": secret },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 })
await client.connect()

const nest = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId",
         (SELECT COUNT(*)::int FROM photos p WHERE p."surveyId" = s.id) AS photo_count,
         ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected"
  FROM surveys s
  LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
  WHERE s."ulbCode" = '801262'
    AND regexp_replace(coalesce(s."wardNumber",''), '^0+', '') = '12'
    AND s."deletedAt" IS NULL
`)

const p305anywhere = await client.query(`
  SELECT s.id, s."legacySurveyId", s."parcelNumber", s."propertyId", s."wardNumber", s."ulbCode",
         (SELECT COUNT(*)::int FROM photos p WHERE p."surveyId" = s.id) AS photo_count
  FROM surveys s
  WHERE s."deletedAt" IS NULL
    AND (
      regexp_replace(coalesce(s."parcelNumber",''), '^0+', '') = '305'
      OR s."propertyId" ILIKE '%00305%'
      OR s."propertyId" ILIKE '%-305-%'
    )
  LIMIT 30
`)

const zeroImg = await client.query(`
  SELECT COUNT(*)::int AS completed_zero
  FROM migration_state
  WHERE status = 'COMPLETED' AND "imagesImported" = 0
`)

const etahZeroPhotos = await client.query(`
  SELECT COUNT(*)::int AS etah_surveys_no_photos
  FROM surveys s
  WHERE s."ulbCode" = '801262' AND s."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id)
`)

await client.end()

const nestByLegacy = new Map(nest.rows.filter((r) => r.legacySurveyId).map((r) => [r.legacySurveyId, r]))

const convex = []
let cursor = null
let isDone = false
let scanned = 0
while (!isDone) {
  const page = await post("/etl/list-survey-ids", {
    cursor,
    numItems: 200,
    statuses: ["draft", "submitted", "approved", "rejected"],
  })
  scanned += page.ids.length
  for (let i = 0; i < page.ids.length; i += 50) {
    const chunk = page.ids.slice(i, i + 50)
    const result = await post("/etl/get-survey-bundles", { ids: chunk })
    for (const b of result.bundles || []) {
      if (b.municipalityCode !== "801262" || bare(b.wardNo) !== "12") continue
      convex.push({
        convexId: b._id,
        parcelNo: b.parcelNo,
        propertyId: b.propertyId ?? null,
        status: b.status,
        photoCount: (b.photos || []).length,
        urlCount: (b.photos || []).filter((p) => p.url).length,
      })
    }
  }
  cursor = page.continueCursor
  isDone = page.isDone
}

const convexWithPhotosMissingNest = convex.filter((c) => c.urlCount > 0 && !nestByLegacy.has(c.convexId))
const nestOrphans = nest.rows.filter((r) => r.legacySurveyId && !convex.some((c) => c.convexId === r.legacySurveyId))
const matched = convex.filter((c) => nestByLegacy.has(c.convexId))
const matchedMissingPhotos = matched.filter((c) => (nestByLegacy.get(c.convexId)?.photo_count ?? 0) === 0 && c.urlCount > 0)

const out = {
  scannedIds: scanned,
  nestWard12: nest.rows.length,
  convexWard12: convex.length,
  convexWithPhotos: convex.filter((c) => c.urlCount > 0).length,
  matched: matched.length,
  convexWithPhotosMissingNest: convexWithPhotosMissingNest.length,
  matchedMissingPhotos: matchedMissingPhotos.length,
  nestOrphans: nestOrphans.length,
  etahSurveysNoPhotos: etahZeroPhotos.rows[0],
  completedZeroImages: zeroImg.rows[0],
  parcel305Anywhere: p305anywhere.rows,
  missingNestSamples: convexWithPhotosMissingNest
    .filter((c) => ["304", "305", "00304", "00305"].includes(bare(c.parcelNo)) || true)
    .slice(0, 15),
  missing305: convexWithPhotosMissingNest.filter((c) => bare(c.parcelNo) === "305"),
  missing304: convexWithPhotosMissingNest.filter((c) => bare(c.parcelNo) === "304"),
  nest304305: nest.rows.filter((r) => ["304", "305"].includes(bare(r.parcelNumber))),
}

log("A", "Ward 12 Convex vs Nest gap", {
  scannedIds: scanned,
  nestWard12: nest.rows.length,
  convexWard12: convex.length,
  convexWithPhotosMissingNest: convexWithPhotosMissingNest.length,
  matchedMissingPhotos: matchedMissingPhotos.length,
  missing305: out.missing305,
  missing304: out.missing304,
  parcel305Anywhere: p305anywhere.rows,
  completedZeroImages: zeroImg.rows[0],
  etahSurveysNoPhotos: etahZeroPhotos.rows[0],
})
console.log(JSON.stringify(out, null, 2))
