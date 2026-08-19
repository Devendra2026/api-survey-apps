import { appendFileSync } from "node:fs"
import pg from "../../packages/database/node_modules/pg/lib/index.js"

const workspaceLog = "c:/sdv-books/projects/sdv-edutech-app/sdv-monorepo-apps/debug-25fc54.log"
function log(data) {
  const payload = {
    sessionId: "25fc54",
    runId: "post-fix-recover",
    hypothesisId: "E",
    location: "probe-305-deleted.mjs",
    message: "Search 305 including deleted",
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
const r = await c.query(`
  SELECT id, "legacySurveyId", "parcelNumber", "propertyId", "wardNumber", "deletedAt", "surveyStatus"::text
  FROM surveys
  WHERE "legacySurveyId" = 'k970djzvy9cbnxewwdc36d9yj98bg13r'
     OR "propertyId" ILIKE '%012-00305%'
     OR ("ulbCode" = '801262' AND regexp_replace(coalesce("wardNumber",''), '^0+', '') = '12'
         AND regexp_replace(coalesce("parcelNumber",''), '^0+', '') = '305')
`)
const photos00902 = await c.query(`
  SELECT COUNT(*)::int AS n FROM photos
  WHERE "surveyId" IN (
    SELECT id FROM surveys WHERE "legacySurveyId" IN ('k975csv0sk9at1bm2sm9vp1cxn8b5nyb','k977ecv7h1h4rrh8tgpc3xav5h8axx3j')
  )
`)
await c.end()
const out = { matches: r.rows, repairedPhotoRows: photos00902.rows[0] }
log(out)
console.log(JSON.stringify(out, null, 2))
