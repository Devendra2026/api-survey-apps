import { defineConfig } from "prisma/config"
import { loadRootEnv } from "./load-root-env.js"

loadRootEnv(import.meta.url)

/**
 * Prefer DIRECT_URL for migrate/deploy when a pooled URL is used at runtime.
 * Runtime app connections continue to use DATABASE_URL via createPrismaClient().
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
