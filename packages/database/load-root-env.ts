import { config } from "dotenv"
import { existsSync } from "node:fs"
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

/** Load monorepo-root `.env` then `.env.local` (local overrides). */
export function loadRootEnv(fromImportMetaUrl: string) {
  const start = dirname(fileURLToPath(fromImportMetaUrl))
  const root = findMonorepoRoot(start)
  const base = join(root, ".env")
  const local = join(root, ".env.local")
  if (existsSync(base)) config({ path: base })
  if (existsSync(local)) config({ path: local, override: true })
}
