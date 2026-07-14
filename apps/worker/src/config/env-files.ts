import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export function findMonorepoRoot(start = process.cwd()): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

export function monorepoEnvFiles(start = process.cwd()): string[] {
  const root = findMonorepoRoot(start)
  const nodeEnv = process.env.NODE_ENV ?? readNodeEnvFromFile(join(root, ".env.local")) ?? "development"
  return [join(root, ".env.local"), join(root, `.env.${nodeEnv}`), join(root, ".env")].filter((path) =>
    existsSync(path)
  )
}

export function monorepoRootFromUrl(importMetaUrl: string): string {
  return findMonorepoRoot(dirname(fileURLToPath(importMetaUrl)))
}

function readNodeEnvFromFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined
  const match = readFileSync(path, "utf8").match(/^NODE_ENV=(.+)$/m)
  return match?.[1]?.trim() || undefined
}
