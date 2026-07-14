import fs from "node:fs"

const rawPath = "prisma/migrations/_enterprise_raw.sql"
const outDir = "prisma/migrations/20260714020000_enterprise_domain_hardening"
const outPath = `${outDir}/migration.sql`

let sql = fs.readFileSync(rawPath, "utf8").replace(/^\uFEFF/, "")

// Insert expand-contract helpers before SET NOT NULL / uniqueness.
const expand = `
-- Expand: default assignment = creator for existing rows (immutable createdBy preserved)
UPDATE "surveys"
SET "assignedToId" = "createdById",
    "assignedAt" = COALESCE("assignedAt", "createdAt")
WHERE "assignedToId" IS NULL;

-- GPS coordinate range checks (additive; validated at DB layer)
ALTER TABLE "surveys" DROP CONSTRAINT IF EXISTS "surveys_latitude_range";
ALTER TABLE "surveys" DROP CONSTRAINT IF EXISTS "surveys_longitude_range";
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));

-- Active tenant-role uniqueness treating NULL scope columns as equal
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenant_roles_active_scope_unique"
ON "user_tenant_roles" (
  "userId",
  "roleId",
  COALESCE("stateId", ''),
  COALESCE("districtId", ''),
  COALESCE("ulbId", ''),
  COALESCE("wardId", '')
)
WHERE "isActive" = true;

-- Exactly one FRONT photo per survey
CREATE UNIQUE INDEX IF NOT EXISTS "photos_surveyId_front_unique"
ON "photos" ("surveyId")
WHERE "photoType" = 'FRONT';
`

// Place expand block after AlterTable surveys section ends (before user_tenant_roles alter continues)
// Safer: append custom SQL before final FKs or at end.
sql = sql.trimEnd() + "\n" + expand

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outPath, sql)
fs.unlinkSync(rawPath)
console.log("wrote", outPath, fs.statSync(outPath).size, "bytes")
