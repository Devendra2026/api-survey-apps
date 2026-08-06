#!/usr/bin/env node
/**
 * Phase 1/2 Baghpat (or Etah) safe-sync ops runner.
 *
 * Requires:
 *   API_URL=https://backend.sdvedutech.in
 *   ETL_BEARER_TOKEN=<Clerk JWT with etl:manage>
 *   ETL_DISTRICT_ID=<district uuid>   # or --district-id
 *
 * Usage:
 *   node scripts/ops/run-district-parity.mjs --district-id <id> --phase dry
 *   node scripts/ops/run-district-parity.mjs --district-id <id> --phase apply
 *
 * --phase dry   : reconcile + align dry-run + refresh dry-run (no writes)
 * --phase apply : align apply + refresh apply + reconcile (writes PENDING only)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
loadEnvFiles([
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, ".env.development"),
  resolve(root, "apps/api/.env.local"),
  resolve(root, "apps/api/.env.development"),
])

const flags = parseFlags(process.argv.slice(2))
const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "")
const bearer = process.env.ETL_BEARER_TOKEN || process.env.CLERK_JWT || flags.token
const districtId = (flags["district-id"] || flags.districtId || process.env.ETL_DISTRICT_ID || "").toString().trim()
const phase = (flags.phase || "dry").toString()

if (!bearer) {
  console.error("Missing ETL_BEARER_TOKEN (Clerk JWT with etl:manage).")
  process.exit(1)
}
if (!districtId) {
  console.error("Missing --district-id <uuid> or ETL_DISTRICT_ID.")
  process.exit(1)
}
if (phase !== "dry" && phase !== "apply") {
  console.error("--phase must be dry|apply")
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${bearer}`,
  "Content-Type": "application/json",
  Accept: "application/json",
}

const outDir = resolve(root, "tmp/ops-parity")
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const reportPath = resolve(outDir, `${phase}-${districtId.slice(0, 8)}-${stamp}.json`)

const report = { apiBase, districtId, phase, steps: {} }

console.log(`API ${apiBase} district=${districtId} phase=${phase}`)

report.steps.reconcileBefore = await api("POST", "/etl/reconcile-with-convex", { districtId })
console.log(
  "reconcile:",
  JSON.stringify(report.steps.reconcileBefore.totals ?? report.steps.reconcileBefore, null, 2)
)

report.steps.align = await api("POST", "/etl/align-wards-with-convex", {
  districtId,
  apply: phase === "apply",
})
console.log("align:", JSON.stringify({ mode: report.steps.align.mode, ok: report.steps.align.ok }, null, 2))

report.steps.refresh = await api("POST", "/etl/refresh-pending", {
  districtId,
  apply: phase === "apply",
  batchSize: Number(process.env.ETL_BATCH_SIZE || 100),
})
console.log("refresh:", JSON.stringify(report.steps.refresh, null, 2))

if (phase === "apply" && report.steps.refresh.jobId) {
  report.steps.refreshWatch = await watchJob(report.steps.refresh.jobId)
  report.steps.reconcileAfter = await api("POST", "/etl/reconcile-with-convex", { districtId })
  console.log("reconcile after:", JSON.stringify(report.steps.reconcileAfter.totals, null, 2))
}

writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(`Wrote ${reportPath}`)

async function watchJob(jobId) {
  for (let i = 0; i < 120; i++) {
    const reportJob = await api("GET", `/etl/report?jobId=${encodeURIComponent(jobId)}`)
    const status = reportJob?.status ?? reportJob?.data?.status
    process.stdout.write(`\rjob ${jobId} status=${status}   `)
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      console.log("")
      return reportJob
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`Timed out waiting for job ${jobId}`)
}

async function api(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  const payload = json?.data !== undefined && json?.success !== undefined ? json.data : json
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 800)}`)
  }
  return payload
}

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

function loadEnvFiles(paths) {
  for (const file of paths) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}
