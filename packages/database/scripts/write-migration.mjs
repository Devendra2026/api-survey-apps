import fs from "node:fs"

const tmpPath = "tmp_migration.sql"
const outPath = "prisma/migrations/20260713041000_property_tax_domain/migration.sql"

let sql = fs.readFileSync(tmpPath, "utf8").replace(/^\uFEFF/, "")
sql = sql.replace(/-- CreateSchema[\s\S]*?CREATE SCHEMA IF NOT EXISTS "public";\s*/u, "")

const header = `-- Drop stub User from 20260710195042_init (password-based) before Clerk-aligned domain
DROP TABLE IF EXISTS "User" CASCADE;

`

fs.mkdirSync("prisma/migrations/20260713041000_property_tax_domain", { recursive: true })
fs.writeFileSync(outPath, header + sql, { encoding: "utf8" })
fs.unlinkSync(tmpPath)

const bytes = fs.readFileSync(outPath)
console.log("wrote", bytes.length, "bytes; start=", [...bytes.subarray(0, 12)])
console.log(bytes.toString("utf8").split("\n").slice(0, 10).join("\n"))
