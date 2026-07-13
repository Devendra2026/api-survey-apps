import { loadRootEnv } from "./load-root-env.js"
import { defineConfig, env } from "prisma/config"

loadRootEnv(import.meta.url)

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
