#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"

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
const prod = {}
const prodPath = resolve(root, ".env.production")
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
    runId: "post-fix-recover",
    hypothesisId,
    location: "probe-recover-0005-305.mjs",
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

const res = await fetch(`${siteUrl}/etl/get-survey-bundles`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-ETL-Secret": secret },
  body: JSON.stringify({
    ids: ["k975myrav11zpxaz828eg3fr1s88gn04", "k970djzvy9cbnxewwdc36d9yj98bg13r"],
  }),
})
const { bundles } = JSON.parse(await res.text())

async function tryGet(url) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow" })
    const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null
    return {
      urlHost: new URL(url).host,
      urlPath: new URL(url).pathname.slice(0, 80),
      status: r.status,
      contentType: r.headers.get("content-type"),
      bytes: buf?.byteLength ?? 0,
      magic: buf && buf.length >= 3 ? buf.subarray(0, 3).toString("hex") : null,
    }
  } catch (err) {
    return { url: url.slice(0, 80), error: err instanceof Error ? err.message : String(err) }
  }
}

const storageHosts = [
  "https://api.sdvedutech.in",
  siteUrl,
  "https://site.sdvedutech.in",
]

const results = []
for (const b of bundles) {
  for (const p of b.photos || []) {
    const attempts = []
    if (p.url) attempts.push(await tryGet(p.url))
    if (p.storageId) {
      for (const host of storageHosts) {
        attempts.push(await tryGet(`${host}/api/storage/${p.storageId}`))
        attempts.push(await tryGet(`${host}/storage/${p.storageId}`))
      }
    }
    results.push({
      convexId: b._id,
      parcelNo: b.parcelNo,
      slot: p.slot,
      storageId: p.storageId ?? null,
      bundleUrlPresent: Boolean(p.url),
      attempts,
    })
  }
}

const require = createRequire(resolve(root, "apps/api/package.json"))
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
})
const repairedKey = "etah-images/district-ETA/ward-01/k975csv0sk9at1bm2sm9vp1cxn8b5nyb/front.jpg"
let repairedStream = null
try {
  const out = await s3.send(new GetObjectCommand({ Bucket: "api-survey-app", Key: repairedKey }))
  const chunks = []
  for await (const chunk of out.Body) chunks.push(Buffer.from(chunk))
  const buf = Buffer.concat(chunks)
  repairedStream = {
    ok: true,
    bytes: buf.byteLength,
    contentType: out.ContentType,
    magic: buf.subarray(0, 3).toString("hex"),
  }
} catch (err) {
  repairedStream = { ok: false, error: err instanceof Error ? err.message : String(err) }
}

const out = { results, repairedStream }
log("D", "Recoverability of 0005/305 and repaired 00902 stream", out)
console.log(JSON.stringify(out, null, 2))
