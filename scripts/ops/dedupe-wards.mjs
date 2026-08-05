#!/usr/bin/env node
/**
 * Dedupe Nest wards per ULB by normalized ward number.
 *
 * Dry-run by default. Pass --apply to remap surveys and soft-delete duplicates.
 *
 * Usage (from api-survey-apps):
 *   node scripts/ops/dedupe-wards.mjs
 *   node scripts/ops/dedupe-wards.mjs --apply
 *   node scripts/ops/dedupe-wards.mjs --ulb-code=XXXX --apply
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const root = resolve(import.meta.dirname, "../..")
loadEnvFiles([
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, "apps/api/.env.local"),
])

const apply = process.argv.includes("--apply")
const ulbCodeFlag = process.argv.find((a) => a.startsWith("--ulb-code="))?.slice("--ulb-code=".length)

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL missing")
  process.exit(2)
}

function normalizeWardNumber(wardNo) {
  const trimmed = String(wardNo ?? "").trim()
  if (!trimmed) return trimmed
  if (/^\d+$/.test(trimmed)) return String(Number.parseInt(trimmed, 10))
  return trimmed
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
})
await client.connect()

try {
  const ulbs = await client.query(
    `SELECT id, code, name FROM ulbs ${ulbCodeFlag ? "WHERE code = $1" : ""} ORDER BY code`,
    ulbCodeFlag ? [ulbCodeFlag] : []
  )

  let groupsFixed = 0
  let surveysRemapped = 0
  let wardsDeleted = 0

  for (const ulb of ulbs.rows) {
    const wards = await client.query(
      `SELECT id, "wardNumber", "wardName", "wardCode", "createdAt",
              (SELECT COUNT(*)::int FROM surveys s WHERE s."wardId" = w.id AND s."deletedAt" IS NULL) AS survey_count
       FROM wards w
       WHERE w."ulbId" = $1 AND w."deletedAt" IS NULL
       ORDER BY w."createdAt" ASC`,
      [ulb.id]
    )

    /** @type {Map<string, typeof wards.rows>} */
    const byNorm = new Map()
    for (const w of wards.rows) {
      const key = normalizeWardNumber(w.wardNumber)
      const list = byNorm.get(key) ?? []
      list.push(w)
      byNorm.set(key, list)
    }

    for (const [norm, group] of byNorm) {
      if (group.length < 2) continue
      groupsFixed += 1

      // Prefer exact canonical spelling, else highest survey count, else oldest.
      const sorted = [...group].sort((a, b) => {
        const aCanon = a.wardNumber === norm ? 0 : 1
        const bCanon = b.wardNumber === norm ? 0 : 1
        if (aCanon !== bCanon) return aCanon - bCanon
        if (b.survey_count !== a.survey_count) return b.survey_count - a.survey_count
        return new Date(a.createdAt) - new Date(b.createdAt)
      })
      const primary = sorted[0]
      const dupes = sorted.slice(1)

      console.log(
        JSON.stringify({
          ulb: ulb.code,
          norm,
          primary: { id: primary.id, wardNumber: primary.wardNumber, surveys: primary.survey_count },
          dupes: dupes.map((d) => ({ id: d.id, wardNumber: d.wardNumber, surveys: d.survey_count })),
        })
      )

      if (!apply) continue

      await client.query("BEGIN")
      try {
        for (const dupe of dupes) {
          const remapped = await client.query(
            `UPDATE surveys SET "wardId" = $1, "wardNumber" = $2, "updatedAt" = NOW()
             WHERE "wardId" = $3 AND "deletedAt" IS NULL`,
            [primary.id, primary.wardNumber, dupe.id]
          )
          surveysRemapped += remapped.rowCount ?? 0
          await client.query(
            `UPDATE wards SET "deletedAt" = NOW(), status = 'DISABLED', "updatedAt" = NOW()
             WHERE id = $1 AND "deletedAt" IS NULL`,
            [dupe.id]
          )
          wardsDeleted += 1
        }
        // Normalize primary spelling if needed
        if (primary.wardNumber !== norm) {
          await client.query(`UPDATE wards SET "wardNumber" = $1, "updatedAt" = NOW() WHERE id = $2`, [
            norm,
            primary.id,
          ])
        }
        await client.query("COMMIT")
      } catch (err) {
        await client.query("ROLLBACK")
        throw err
      }
    }
  }

  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      ulbs: ulbs.rows.length,
      duplicateGroups: groupsFixed,
      surveysRemapped,
      wardsSoftDeleted: wardsDeleted,
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
