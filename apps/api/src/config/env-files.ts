import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Walk up from `start` until `pnpm-workspace.yaml` is found. */
export function findMonorepoRoot(start = process.cwd()): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

/**
 * Root env files for Nest ConfigModule (first existing file wins per key).
 * Prefer `.env.local` overrides, then `.env`.
 */
export function monorepoEnvFiles(start = process.cwd()): string[] {
  const root = findMonorepoRoot(start)
  return [join(root, ".env.local"), join(root, ".env")].filter((path) => existsSync(path))
}

/** Absolute path to monorepo root (for scripts / ESM packages). */
export function monorepoRootFromUrl(importMetaUrl: string): string {
  return findMonorepoRoot(dirname(fileURLToPath(importMetaUrl)))
}
