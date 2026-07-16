import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootEnv = path.join(root, ".env.local")
const webEnv = path.join(root, "apps", "web", ".env.local")

const rootText = readFileSync(rootEnv, "utf8")
const match = rootText.match(/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.+)$/m)
if (!match) {
  console.error("No NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in repo-root .env.local")
  process.exit(1)
}
const key = match[1].trim().replace(/^["']|["']$/g, "")
if (!key) {
  console.error("Empty NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in repo-root .env.local")
  process.exit(1)
}

let web = existsSync(webEnv) ? readFileSync(webEnv, "utf8") : ""
const line = `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${key}`
if (/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=/m.test(web)) {
  web = web.replace(/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=.*$/m, line)
} else {
  if (web.length && !web.endsWith("\n")) web += "\n"
  web +=
    "# Keep in sync with repo-root .env.local (Next also loads apps/web/.env.local).\n" +
    `${line}\n`
}
writeFileSync(webEnv, web)
console.log(`Synced Maps key into apps/web/.env.local (len=${key.length})`)
