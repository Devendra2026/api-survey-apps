import { config } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function findMonorepoRoot(start: string): string {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) return resolve(start)
    dir = parent
  }
}

/** Load root env with local > env-specific > base precedence. */
export function loadRootEnv(fromImportMetaUrl: string) {
  const start = dirname(fileURLToPath(fromImportMetaUrl))
  const root = findMonorepoRoot(start)
  const base = join(root, ".env")
  const local = join(root, ".env.local")
  const nodeEnv = process.env.NODE_ENV ?? readNodeEnvFromFile(local) ?? "development"
  const envSpecific = join(root, `.env.${nodeEnv}`)

  if (existsSync(base)) config({ path: base })
  if (existsSync(envSpecific)) config({ path: envSpecific, override: true })
  if (existsSync(local)) config({ path: local, override: true })
}

function readNodeEnvFromFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined
  const match = readFileSync(path, "utf8").match(/^NODE_ENV=(.+)$/m)
  return match?.[1]?.trim() || undefined
}
