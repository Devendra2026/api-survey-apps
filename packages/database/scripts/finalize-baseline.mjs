import fs from "node:fs"

const rawPath = "prisma/migrations/_baseline_raw.sql"
const outPath = "prisma/migrations/20260713041000_property_tax_domain/migration.sql"

let sql = fs.readFileSync(rawPath, "utf8").replace(/^\uFEFF/, "")
sql = sql.replace(/-- CreateSchema[\s\S]*?CREATE SCHEMA IF NOT EXISTS "public";\s*/u, "")

fs.mkdirSync("prisma/migrations/20260713041000_property_tax_domain", { recursive: true })
fs.writeFileSync(outPath, sql)
fs.unlinkSync(rawPath)

const bytes = fs.readFileSync(outPath)
console.log("wrote", bytes.length, "bytes; bom=", bytes[0] === 0xef)
console.log(bytes.toString("utf8").split("\n").slice(0, 8).join("\n"))
