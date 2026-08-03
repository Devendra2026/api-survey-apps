import pg from "pg"

const c = new pg.Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const indexes = await c.query(
  `SELECT indexname FROM pg_indexes WHERE tablename = 'floors' AND indexname LIKE '%floorPosition%' ORDER BY indexname`
)
console.log(
  "indexes:",
  indexes.rows.map((r) => r.indexname)
)

const legacy = indexes.rows.find((r) => r.indexname === "floors_surveyId_floorPosition_key")
const mixed = indexes.rows.find((r) => r.indexname === "floors_surveyId_floorPosition_usageFactor_key")
if (legacy) {
  console.error("FAIL: legacy floors_surveyId_floorPosition_key still present")
  await c.end()
  process.exit(1)
}
if (!mixed) {
  console.error("FAIL: mixed-use unique index missing")
  await c.end()
  process.exit(1)
}
console.log("PASS: only mixed-use unique on floorPosition remains")

const survey = await c.query(`SELECT id FROM surveys WHERE "deletedAt" IS NULL LIMIT 1`)
if (!survey.rows[0]) {
  console.log("No survey found; skipping live insert matrix (indexes OK)")
  await c.end()
  process.exit(0)
}

const surveyId = survey.rows[0].id
const suffix = Date.now()

await c.query("BEGIN")
try {
  await c.query(`DELETE FROM floors WHERE "surveyId" = $1`, [surveyId])

  await c.query(
    `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
     VALUES ($1, $2, 'GROUND_FLOOR', 'RESIDENTIAL', 300, 0, NOW(), NOW())`,
    [`verify-res-${suffix}`, surveyId]
  )

  await c.query(
    `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
     VALUES ($1, $2, 'GROUND_FLOOR', 'COMMERCIAL', 300, 1, NOW(), NOW())`,
    [`verify-com-${suffix}`, surveyId]
  )
  console.log("PASS: Ground Res + Ground Com allowed")

  await c.query("SAVEPOINT before_dup")
  let dupRejected = false
  try {
    await c.query(
      `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
       VALUES ($1, $2, 'GROUND_FLOOR', 'RESIDENTIAL', 100, 2, NOW(), NOW())`,
      [`verify-dup-${suffix}`, surveyId]
    )
  } catch (e) {
    if (e.code === "23505") {
      dupRejected = true
      await c.query("ROLLBACK TO SAVEPOINT before_dup")
    } else throw e
  }
  if (!dupRejected) throw new Error("duplicate Ground Res should have been rejected")
  console.log("PASS: duplicate Ground Res rejected")

  await c.query("SAVEPOINT before_com_dup")
  let comDupRejected = false
  try {
    await c.query(
      `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
       VALUES ($1, $2, 'GROUND_FLOOR', 'COMMERCIAL', 100, 2, NOW(), NOW())`,
      [`verify-com-dup-${suffix}`, surveyId]
    )
  } catch (e) {
    if (e.code === "23505") {
      comDupRejected = true
      await c.query("ROLLBACK TO SAVEPOINT before_com_dup")
    } else throw e
  }
  if (!comDupRejected) throw new Error("duplicate Ground Com should have been rejected")
  console.log("PASS: duplicate Ground Com rejected")

  await c.query(
    `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
     VALUES ($1, $2, 'FIRST_FLOOR', 'RESIDENTIAL', 100, 3, NOW(), NOW())`,
    [`verify-first-${suffix}`, surveyId]
  )
  console.log("PASS: Ground Res + First Res allowed")

  await c.query(
    `INSERT INTO floors (id, "surveyId", "floorPosition", "usageFactor", "areaSqFt", position, "createdAt", "updatedAt")
     VALUES ($1, $2, 'FIRST_FLOOR', 'COMMERCIAL', 100, 4, NOW(), NOW())`,
    [`verify-first-com-${suffix}`, surveyId]
  )
  console.log("PASS: First Res + First Com allowed")
} finally {
  await c.query("ROLLBACK")
  console.log("rolled back test data (no persistent changes)")
}

await c.end()
