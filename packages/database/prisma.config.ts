import "dotenv/config"
import { defineConfig, env } from "prisma/config"

/**
 * Prefer DIRECT_URL for migrate/deploy when a pooled URL is used at runtime.
 * Runtime app connections continue to use DATABASE_URL via createPrismaClient().
 *
 * `datasource.url` is required for Prisma v7 migration commands
 * (`prisma migrate deploy` / `migrate dev`). Load `.env` here so local
 * `pnpm db:deploy` resolves DATABASE_URL without a prior shell export.
 * Production/CI inject env vars; dotenv is a no-op when no file is present.
 * The migrate image already vendors dotenv in the pruned deploy tree.
 */
function resolveDatasourceUrl(): string {
  const direct = process.env.DIRECT_URL?.trim()
  if (direct) return direct
  return env("DATABASE_URL")
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
