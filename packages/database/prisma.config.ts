import { defineConfig } from "prisma/config"

/**
 * Prefer DIRECT_URL for migrate/deploy when a pooled URL is used at runtime.
 * Runtime app connections continue to use DATABASE_URL via createPrismaClient().
 *
 * Env must already be present (Dokploy/Compose inject; local: export or root `.env`
 * loaded by the calling tool). Avoid importing `dotenv` here — the production
 * migrate image resolves modules from a pruned pnpm deploy tree.
 */
function resolveDatasourceUrl(): string {
  const direct = process.env.DIRECT_URL?.trim()
  if (direct) return direct
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) return databaseUrl
  throw new Error("DATABASE_URL (or DIRECT_URL) is not set")
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
})
