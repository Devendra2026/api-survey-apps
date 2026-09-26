import pg from "pg"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL missing")
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()

const kind = await client.query(
  `SELECT 1 FROM information_schema.columns WHERE table_name = 'wards' AND column_name = 'kind'`
)
const wards = await client.query(
  `SELECT w."wardNumber", w."wardName", w.kind::text AS kind
   FROM wards w
   JOIN ulbs u ON u.id = w."ulbId"
   WHERE u.name ILIKE '%Etah Municipal%'
     AND w."deletedAt" IS NULL
   ORDER BY w."wardNumber"`
)

console.log(
  JSON.stringify(
    {
      hasKind: (kind.rowCount ?? 0) > 0,
      wardCount: wards.rowCount,
      wards: wards.rows,
    },
    null,
    2
  )
)

await client.end()
