import { appendFileSync } from "node:fs"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const workspaceLog = "c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log"
function log(data) {
  const payload = {
    sessionId: "25fc54",
    runId: "donor-geo",
    hypothesisId: "E",
    location: "probe-ward12-donor.mjs",
    message: "Ward 12 donor geo for 00305 stub",
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

const c = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/survey?schema=public" })
await c.connect()
const donor = await c.query(`
  SELECT id, "stateId", "districtId", "ulbId", "wardId", "createdById", "assessmentYear"::text,
         "ulbCode", "wardNumber", "districtName"
  FROM surveys
  WHERE "ulbCode" = '801262'
    AND regexp_replace(coalesce("wardNumber",''), '^0+', '') = '12'
    AND "propertyId" LIKE '801262-012-%'
    AND "deletedAt" IS NULL
  ORDER BY "parcelNumber"
  LIMIT 1
`)
const clash = await c.query(`
  SELECT id, "propertyId", "parcelNumber", "legacySurveyId"
  FROM surveys
  WHERE "ulbId" = $1 AND "propertyId" = '801262-012-00305-001-R' AND "deletedAt" IS NULL
`, [donor.rows[0]?.ulbId])
await c.end()
const out = { donor: donor.rows[0] ?? null, propertyClash: clash.rows }
log(out)
console.log(JSON.stringify(out, null, 2))
