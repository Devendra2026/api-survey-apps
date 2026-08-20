#!/usr/bin/env node
/**
 * List PENDING Nest surveys with zero Photo rows (candidates for ETL photo backfill).
 * After deploying the photo-backfill ETL fix, run INCREMENTAL ETL or reconcile --apply.
 *
 * Usage:
 *   node scripts/ops/backfill-zero-photo-surveys.mjs
 *   node scripts/ops/backfill-zero-photo-surveys.mjs --survey-id d5ef840c-db61-41f6-bfdd-ea5d8bc36c64
 *   node scripts/ops/backfill-zero-photo-surveys.mjs --ulb 801262 --ward 12 --limit 50
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const root = resolve(import.meta.dirname, "../..")

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

for (const file of [
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, ".env.development"),
  resolve(root, "packages/database/.env"),
  resolve(root, ".env.production"),
]) {
  loadEnv(file)
}

const flags = parseFlags(process.argv.slice(2))
const surveyId = String(flags["survey-id"] ?? "").trim()
const ulbCode = String(flags.ulb ?? "").trim()
const wardNo = String(flags.ward ?? "").trim()
const limit = Math.min(500, Math.max(1, Number(flags.limit ?? 100) || 100))

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing")
  process.exit(2)
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
      i += 1
    }
  }
  return out
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 })
await client.connect()

try {
  if (surveyId) {
    const { rows } = await client.query(
      `
      SELECT s.id, s."legacySurveyId", s."parcelNumber", s."wardNumber", s."ulbCode",
             s."qcStatus"::text AS qc_status,
             (SELECT COUNT(*)::int FROM photos p WHERE p."surveyId" = s.id) AS photo_count,
             ms.status::text AS mig_status, ms."imagesImported", ms."imagesExpected", ms."lastError"
      FROM surveys s
      LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
      WHERE s.id = $1 AND s."deletedAt" IS NULL
      `,
      [surveyId]
    )
    console.log(JSON.stringify({ mode: "single", row: rows[0] ?? null }, null, 2))
  } else {
    const params = []
    let where = `
      s."deletedAt" IS NULL
      AND s."qcStatus" = 'PENDING'
      AND s."legacySurveyId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM photos p WHERE p."surveyId" = s.id)
    `
    if (ulbCode) {
      params.push(ulbCode)
      where += ` AND s."ulbCode" = $${params.length}`
    }
    if (wardNo) {
      params.push(wardNo)
      where += ` AND s."wardNumber" = $${params.length}`
    }
    params.push(limit)
    const { rows } = await client.query(
      `
      SELECT s.id, s."legacySurveyId", s."parcelNumber", s."wardNumber", s."ulbCode",
             ms.status::text AS mig_status, ms."imagesImported", ms."lastError"
      FROM surveys s
      LEFT JOIN migration_state ms ON ms."legacySurveyId" = s."legacySurveyId"
      WHERE ${where}
      ORDER BY s."wardNumber", s."parcelNumber"
      LIMIT $${params.length}
      `,
      params
    )
    console.log(
      JSON.stringify(
        {
          mode: "list",
          filters: { ulbCode: ulbCode || null, wardNo: wardNo || null, limit },
          count: rows.length,
          legacySurveyIds: rows.map((r) => r.legacySurveyId).filter(Boolean),
          rows,
        },
        null,
        2
      )
    )
  }
} finally {
  await client.end()
}
