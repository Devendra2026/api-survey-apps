/**
 * Fetch last Align debug snapshot from production Nest API and append to
 * workspace .cursor/debug-cb377d.log for the Cursor debug session.
 *
 * Usage (from api-survey-apps):
 *   node scripts/ops/fetch-align-debug.mjs
 *
 * Reads ETL_CONVEX_SECRET + API_URL from .env.production
 */
import { appendFile, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")
const envPath = path.join(root, ".env.production")
// api-survey-apps → sdv-edutech-app/.cursor
const logPath = path.resolve(root, "../.cursor/debug-cb377d.log")

function envGet(raw, key) {
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"))
  if (!m) return ""
  return m[1].trim().replace(/^["']|["']$/g, "")
}

const raw = await readFile(envPath, "utf8")
const secret = envGet(raw, "ETL_CONVEX_SECRET")
const apiUrl = (envGet(raw, "API_URL") || envGet(raw, "NEXT_PUBLIC_API_URL") || "https://backend.sdvedutech.in").replace(
  /\/+$/,
  ""
)

if (!secret) {
  console.error("ETL_CONVEX_SECRET missing from .env.production")
  process.exit(1)
}

const res = await fetch(`${apiUrl}/etl/align-debug-last`, {
  headers: { "X-ETL-Secret": secret },
})
const text = await res.text()
let data
try {
  data = JSON.parse(text)
} catch {
  data = { raw: text.slice(0, 500) }
}

const line = JSON.stringify({
  sessionId: "cb377d",
  runId: "prod-fetch",
  hypothesisId: "D",
  location: "fetch-align-debug.mjs",
  message: `align-debug-last HTTP ${res.status}`,
  data: {
    status: res.status,
    revision: data?.data?.revision ?? data?.revision ?? null,
    at: data?.data?.at ?? data?.at ?? null,
    ok: data?.data?.result?.ok ?? data?.result?.ok ?? null,
    conflicts: (data?.data?.result?.steps?.sync?.conflicts ?? data?.result?.steps?.sync?.conflicts ?? []).slice(0, 8),
    debug: data?.data?.result?._debug ?? data?.result?._debug ?? null,
    envelopeKeys: data && typeof data === "object" ? Object.keys(data) : [],
  },
  timestamp: Date.now(),
})

await mkdir(path.dirname(logPath), { recursive: true })
await appendFile(logPath, `${line}\n`, "utf8")
console.log(`Wrote ${logPath}`)
console.log(line.slice(0, 800))
process.exit(res.ok ? 0 : 2)
