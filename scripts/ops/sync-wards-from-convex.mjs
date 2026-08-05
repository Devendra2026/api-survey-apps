#!/usr/bin/env node
/**
 * Upsert Nest wards from Convex ward catalog (Convex is canonical).
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage (from api-survey-apps):
 *   node scripts/ops/sync-wards-from-convex.mjs
 *   node scripts/ops/sync-wards-from-convex.mjs --apply
 *
 * Requires CONVEX_SITE_URL + ETL_CONVEX_SECRET (or ETL_SECRET) and DATABASE_URL.
 */
import { createHash, randomBytes } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const root = resolve(import.meta.dirname, "../..")
loadEnvFiles([
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, "apps/api/.env.local"),
  resolve(root, "apps/worker/.env.local"),
])

const apply = process.argv.includes("--apply")
const siteUrl = (process.env.CONVEX_SITE_URL || "").trim().replace(/\/+$/, "")
const etlSecret = (process.env.ETL_CONVEX_SECRET || process.env.ETL_SECRET || "").trim()
const dbUrl = process.env.DATABASE_URL

if (!siteUrl || !etlSecret) {
  console.error("CONVEX_SITE_URL and ETL_CONVEX_SECRET (or ETL_SECRET) required")
  process.exit(2)
}
if (!dbUrl) {
  console.error("DATABASE_URL missing")
  process.exit(2)
}

function normalizeWardNumber(wardNo) {
  const trimmed = String(wardNo ?? "").trim()
  if (!trimmed) return trimmed
  if (/^\d+$/.test(trimmed)) return String(Number.parseInt(trimmed, 10))
  return trimmed
}

const res = await fetch(`${siteUrl}/etl/list-ward-catalog`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-ETL-Secret": etlSecret,
  },
  body: "{}",
})
if (!res.ok) {
  console.error(`Convex list-ward-catalog failed: ${res.status} ${await res.text()}`)
  process.exit(1)
}
const { wards: catalog } = await res.json()
if (!Array.isArray(catalog)) {
  console.error("Unexpected catalog response")
  process.exit(1)
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
})
await client.connect()

let created = 0
let updated = 0
let skipped = 0
const missingUlbs = new Set()

try {
  for (const row of catalog) {
    const wardNumber = normalizeWardNumber(row.wardNo)
    const wardCode = String(row.wardCode || "").trim().toUpperCase()
    const wardName = String(row.wardName || `Ward ${wardNumber}`).trim()
    const ulbCode = String(row.municipalityCode || "").trim()

    const ulb = await client.query(`SELECT id, code FROM ulbs WHERE code = $1 LIMIT 1`, [ulbCode])
    if (!ulb.rows[0]) {
      missingUlbs.add(ulbCode)
      skipped += 1
      continue
    }
    const ulbId = ulb.rows[0].id

    const active = await client.query(
      `SELECT id, "wardNumber", "wardCode", "wardName" FROM wards
       WHERE "ulbId" = $1 AND "deletedAt" IS NULL`,
      [ulbId]
    )
    const match =
      active.rows.find((w) => (wardCode && w.wardCode === wardCode) || normalizeWardNumber(w.wardNumber) === wardNumber) ??
      null

    if (match) {
      const needsUpdate =
        match.wardNumber !== wardNumber ||
        (wardCode && match.wardCode !== wardCode) ||
        match.wardName !== wardName
      console.log(
        JSON.stringify({
          action: needsUpdate ? "update" : "ok",
          ulb: ulbCode,
          wardNumber,
          wardCode,
          id: match.id,
        })
      )
      if (needsUpdate && apply) {
        await client.query(
          `UPDATE wards SET "wardNumber" = $1, "wardCode" = COALESCE($2, "wardCode"), "wardName" = $3, "updatedAt" = NOW()
           WHERE id = $4`,
          [wardNumber, wardCode || null, wardName, match.id]
        )
        updated += 1
      } else if (needsUpdate) {
        updated += 1
      } else {
        skipped += 1
      }
      continue
    }

    console.log(JSON.stringify({ action: "create", ulb: ulbCode, wardNumber, wardCode, wardName }))
    if (apply) {
      const id = `c${createHash("sha256").update(`${ulbId}:${wardNumber}:${wardCode}`).digest("hex").slice(0, 24)}`
      // Use cuid-like random if preferred — Prisma uses cuid; random is fine for ops.
      const wardId = `w${randomBytes(12).toString("hex")}`
      await client.query(
        `INSERT INTO wards (id, "ulbId", "wardNumber", "wardCode", "wardName", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
        [wardId || id, ulbId, wardNumber, wardCode || null, wardName]
      )
      created += 1
    } else {
      created += 1
    }
  }

  // Hard parity check: Nest active wards with duplicate normalized numbers
  const dupes = await client.query(`
    SELECT u.code AS ulb_code, COUNT(*)::int AS active_wards
    FROM wards w
    JOIN ulbs u ON u.id = w."ulbId"
    WHERE w."deletedAt" IS NULL
    GROUP BY u.code
    ORDER BY u.code
  `)

  const convexByUlb = new Map()
  for (const row of catalog) {
    const c = row.municipalityCode
    convexByUlb.set(c, (convexByUlb.get(c) ?? 0) + 1)
  }

  const parity = []
  for (const row of dupes.rows) {
    const convexCount = convexByUlb.get(row.ulb_code) ?? 0
    if (convexCount !== row.active_wards) {
      parity.push({ ulb: row.ulb_code, nest: row.active_wards, convex: convexCount })
    }
  }

  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      catalogSize: catalog.length,
      created,
      updated,
      skipped,
      missingUlbs: [...missingUlbs],
      wardCountMismatches: parity,
    })
  )
} finally {
  await client.end()
}

function loadEnvFiles(paths) {
  for (const p of paths) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}
