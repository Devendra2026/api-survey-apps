import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

function resolveMonorepoRoot(): string {
  const fromConfig = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  const fromCwd = path.resolve(process.cwd(), "../..")
  const candidates = [fromConfig, fromCwd, process.cwd()]
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "pnpm-workspace.yaml"))) {
      return candidate
    }
  }
  return fromConfig
}

// Single monorepo `.env` at repo root (same file as Nest / Prisma / Compose)
const monorepoRoot = resolveMonorepoRoot()
loadEnvConfig(monorepoRoot)

const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ""

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@workspace/ui", "@workspace/validation"],
  // Dev uses `next dev --webpack` (see package.json) to avoid Turbopack panics in this monorepo.
  // Production `next build` keeps the Next 16 default bundler.
  ...(mapsApiKey
    ? {
        env: {
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: mapsApiKey,
        },
      }
    : {}),
}

export default nextConfig
