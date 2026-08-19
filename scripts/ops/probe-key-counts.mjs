import pg from "../../packages/database/node_modules/pg/lib/index.js"
const c = new pg.Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/survey?schema=public" })
await c.connect()
const r = await c.query(`
  SELECT
    COUNT(*) FILTER (WHERE "objectKey" LIKE '%/ward-1/%')::int AS ward1,
    COUNT(*) FILTER (WHERE "objectKey" LIKE '%/ward-01/%')::int AS ward01,
    COUNT(*) FILTER (WHERE "objectKey" LIKE '%/ward-12/%')::int AS ward12,
    COUNT(*) FILTER (WHERE "objectKey" LIKE 'etah-images/%')::int AS etah_keys,
    COUNT(*) FILTER (WHERE "objectKey" LIKE 'uploads/%')::int AS upload_keys
  FROM photos
`)
console.log(JSON.stringify(r.rows[0]))
await c.end()
