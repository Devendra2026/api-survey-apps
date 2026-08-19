#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const workspaceLog = resolve("c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log")
const DEBUG_INGEST = "http://127.0.0.1:7681/ingest/0fc9f6c6-0c15-443b-bd77-d3106250dbc1"

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnv(resolve(root, ".env.production"))

const siteUrl = (process.env.CONVEX_SITE_URL || "").replace(/\/+$/, "")
const secret = (process.env.ETL_CONVEX_SECRET || "").trim()
const ids = ["k970djzvy9cbnxewwdc36d9yj98bg13r", "k975s0a9rhftm537r6b77v88sx8bhv66"]

function log(hypothesisId, message, data) {
  const payload = {
    sessionId: "25fc54",
    runId: "convex-probe",
    hypothesisId,
    location: "probe-convex-parcel-images.mjs",
    message,
    data,
    timestamp: Date.now(),
  }
  // #region agent log
  fetch(DEBUG_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "25fc54" },
    body: JSON.stringify(payload),
  }).catch(() => { })
  appendFileSync(workspaceLog, `${JSON.stringify(payload)}\n`)
  // #endregion
}

const res = await fetch(`${siteUrl}/etl/get-survey-bundles`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-ETL-Secret": secret },
  body: JSON.stringify({ ids }),
})
const text = await res.text()
if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
const { bundles } = JSON.parse(text)

const rows = []
for (const b of bundles) {
  const photos = []
  for (const p of b.photos || []) {
    let head = null
    if (p.url) {
      const h = await fetch(p.url, { method: "HEAD" })
      head = { status: h.status, contentType: h.headers.get("content-type"), contentLength: h.headers.get("content-length") }
    }
    photos.push({
      slot: p.slot,
      storageId: p.storageId ?? null,
      urlPresent: Boolean(p.url),
      urlHost: p.url ? new URL(p.url).hostname : null,
      urlPath: p.url ? new URL(p.url).pathname : null,
      head,
    })
  }
  const row = {
    convexId: b._id,
    parcelNo: b.parcelNo,
    propertyId: b.propertyId ?? null,
    wardNo: b.wardNo,
    municipalityCode: b.municipalityCode,
    districtCode: b.districtCode,
    status: b.status,
    qcStatus: b.qcStatus,
    createdIso: b._creationTime ? new Date(b._creationTime).toISOString() : null,
    submittedIso: b.submittedAt ? new Date(b.submittedAt).toISOString() : null,
    photoCount: photos.length,
    photos,
  }
  rows.push(row)
  log(b.parcelNo === "00305" ? "A" : "G", "Convex source image probe", row)
}

console.log(JSON.stringify(rows, null, 2))
