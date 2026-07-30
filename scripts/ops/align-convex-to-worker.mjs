#!/usr/bin/env node
/**
 * Emergency: align Convex ETL_SECRET to the value the worker is already sending.
 *
 * The worker's secret lives in Dokploy and cannot be changed from here, so when a
 * redeploy still shows the old fingerprint the fastest route back to a working
 * pipeline is to move the Convex side onto that same value.
 *
 * Reads the candidate from CANDIDATE_SECRET, refuses to act unless its
 * fingerprint matches the one the worker actually sends, then sets Convex and
 * verifies with a live call.
 *
 * Usage:
 *   $env:CANDIDATE_SECRET='<value>'; node ./scripts/ops/align-convex-to-worker.mjs <expected-fingerprint>
 */
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { platform } from "node:process"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const apiSurveyRoot = resolve(here, "../..")
const convexBackendRoot = resolve(apiSurveyRoot, "../sdv-monorepo-apps/packages/backend")

const expectedFingerprint = process.argv[2]
const candidate = (process.env.CANDIDATE_SECRET ?? "").trim()

if (!expectedFingerprint) {
  console.error("Usage: node ./scripts/ops/align-convex-to-worker.mjs <worker-fingerprint>")
  process.exit(1)
}
if (!candidate) {
  console.error("CANDIDATE_SECRET is not set")
  process.exit(1)
}

const fingerprint = (value) => createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12)

function parseEnv(contents) {
  const env = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, eq).trim()] = value
  }
  return env
}

function upsertEnvLine(contents, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, "m")
  if (re.test(contents)) return contents.replace(re, line)
  return `${contents.replace(/\s*$/, "")}\n${line}\n`
}

function setConvexSecret(secret, fileEnv) {
  return new Promise((resolvePromise, reject) => {
    const childEnv = {
      ...process.env,
      CONVEX_SELF_HOSTED_URL: fileEnv.CONVEX_SELF_HOSTED_URL,
      CONVEX_SELF_HOSTED_ADMIN_KEY: fileEnv.CONVEX_SELF_HOSTED_ADMIN_KEY,
    }
    delete childEnv.CONVEX_DEPLOYMENT

    const base = ["exec", "convex", "env", "set", "ETL_SECRET", secret, "--env-file", ".env.production"]
    const isWindows = platform === "win32"
    const command = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm"
    const args = isWindows ? ["/d", "/s", "/c", "pnpm", ...base] : base

    const child = spawn(command, args, { cwd: convexBackendRoot, env: childEnv, stdio: ["ignore", "pipe", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (c) => {
      stderr += c
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`convex env set failed (${code}): ${stderr.slice(0, 500)}`))
    )
  })
}

function verifyAgainstConvex(secret) {
  const bodyPath = join(tmpdir(), "etl-verify-body.json")
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
  return (result.stdout || "").trim()
}

const actual = fingerprint(candidate)
console.log(`candidate fingerprint : ${actual}`)
console.log(`worker sends          : ${expectedFingerprint}`)

if (actual !== expectedFingerprint) {
  console.log("\nRESULT: NO MATCH — this is not the value the worker sends. Convex left unchanged.")
  console.log("The worker's secret can then only be changed in Dokploy.")
  process.exit(2)
}

console.log("\nRESULT: MATCH — pointing Convex at this value so the pipeline recovers now.")

const convexEnv = parseEnv(await readFile(join(convexBackendRoot, ".env.production"), "utf8"))
await setConvexSecret(candidate, convexEnv)
console.log("Convex ETL_SECRET updated.")

const nestEnvFile = join(apiSurveyRoot, ".env.production")
await writeFile(nestEnvFile, upsertEnvLine(await readFile(nestEnvFile, "utf8"), "ETL_CONVEX_SECRET", candidate), "utf8")
console.log("Local .env.production realigned.")

const out = verifyAgainstConvex(candidate)
console.log(out.slice(0, 300))
if (out.includes("http:200")) {
  console.log("\nVERIFIED: Convex accepts the worker's secret. Next cron tick should succeed with no Dokploy change.")
} else {
  console.log("\nWARNING: verification did not return 200 — inspect above.")
  process.exitCode = 3
}
