import pg from "../../packages/database/node_modules/pg/lib/index.js"
const c = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/survey?schema=public" })
await c.connect()
const r = await c.query(`
  SELECT s."parcelNumber", s."legacySurveyId", p.id, p."photoType"::text, p."objectKey", p."sizeBytes", p."importStatus"
  FROM surveys s
  JOIN photos p ON p."surveyId" = s.id
  WHERE s."legacySurveyId" IN ('k975csv0sk9at1bm2sm9vp1cxn8b5nyb', 'k977ecv7h1h4rrh8tgpc3xav5h8axx3j')
  ORDER BY s."parcelNumber", p."photoType"
`)
console.log(JSON.stringify(r.rows, null, 2))
await c.end()
