import type { NextConfig } from "next"
import { loadEnvConfig } from "@next/env"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Single monorepo `.env` at repo root (same file as Nest / Prisma / Compose)
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
loadEnvConfig(monorepoRoot)

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@workspace/ui", "@workspace/validation", "@workspace/database"],
}

export default nextConfig
