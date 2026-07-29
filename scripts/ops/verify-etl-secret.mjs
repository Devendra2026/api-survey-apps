#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const raw = readFileSync(join(root, ".env.production"), "utf8")
const match = raw.match(/^ETL_CONVEX_SECRET=(.*)$/m)
if (!match) {
  console.error("ETL_CONVEX_SECRET missing from .env.production")
  process.exit(1)
}
const secret = match[1].trim().replace(/^["']|["']$/g, "")
const fp = createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 12)
console.log(`env file fingerprint: ${fp}`)

const bodyPath = join(tmpdir(), "etl-body.json")
writeFileSync(bodyPath, JSON.stringify({ cursor: null, numItems: 1 }))

const result = spawnSync(
  "curl.exe",
  [
    "-sS",
    "-X",
    "POST",
    "-H",
    "Content-Type: application/json",
    "-H",
    `X-ETL-Secret: ${secret}`,
    "--data-binary",
    `@${bodyPath}`,
    "-w",
    "\nhttp:%{http_code}\n",
    "https://site.sdvedutech.in/etl/list-survey-ids",
  ],
  { encoding: "utf8" }
)

const out = (result.stdout || "").trim()
console.log(out.slice(0, 500))
if (result.status !== 0) {
  console.error((result.stderr || "").slice(0, 300))
  process.exit(result.status ?? 1)
}

if (out.includes("http:200")) {
  console.log("RESULT: Convex accepts the new secret.")
} else if (out.includes("secret_mismatch")) {
  console.log("RESULT: Still mismatch — Convex env set may not have applied.")
  process.exitCode = 2
} else {
  console.log("RESULT: Unexpected response — inspect above.")
  process.exitCode = 3
}
