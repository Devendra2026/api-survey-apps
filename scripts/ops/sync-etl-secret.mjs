#!/usr/bin/env node
/**
 * Urgently realign the ETL shared secret on both sides of the pipeline.
 *
 * 1. Generates a fresh 32-byte secret (never printed)
 * 2. Sets Convex production ETL_SECRET via self-hosted admin key
 * 3. Updates api-survey-apps/.env.production ETL_CONVEX_SECRET
 * 4. Copies the value to the clipboard for Dokploy UI paste
 *
 * Usage (from api-survey-apps):
 *   node ./scripts/ops/sync-etl-secret.mjs
 */
import { spawn, spawnSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { platform } from "node:process"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const apiSurveyRoot = resolve(here, "../..")
const convexBackendRoot = resolve(apiSurveyRoot, "../sdv-monorepo-apps/packages/backend")
const convexEnvFile = resolve(convexBackendRoot, ".env.production")
const nestEnvFile = resolve(apiSurveyRoot, ".env.production")

function fingerprint(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12)
}

function parseEnv(contents) {
  /** @type {Record<string, string>} */
  const env = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function upsertEnvLine(contents, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, "m")
  if (re.test(contents)) return contents.replace(re, line)
  const trimmed = contents.replace(/\s*$/, "")
  return `${trimmed}\n${line}\n`
}

function copyToClipboard(value) {
  const tools =
    platform === "win32"
      ? [["clip", []]]
      : platform === "darwin"
        ? [["pbcopy", []]]
        : [
          ["wl-copy", []],
          ["xclip", ["-selection", "clipboard"]],
        ]
  for (const [bin, args] of tools) {
    const result = spawnSync(bin, args, { input: value })
    if (!result.error && result.status === 0) return true
  }
  return false
}

function runConvexEnvSet(secret, fileEnv) {
  return new Promise((resolvePromise, reject) => {
    const childEnv = {
      ...process.env,
      CONVEX_SELF_HOSTED_URL: fileEnv.CONVEX_SELF_HOSTED_URL,
      CONVEX_SELF_HOSTED_ADMIN_KEY: fileEnv.CONVEX_SELF_HOSTED_ADMIN_KEY,
    }
    delete childEnv.CONVEX_DEPLOYMENT

    const isWindows = platform === "win32"
    const command = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm"
    const args = isWindows
      ? ["/d", "/s", "/c", "pnpm", "exec", "convex", "env", "set", "ETL_SECRET", secret, "--env-file", ".env.production"]
      : ["exec", "convex", "env", "set", "ETL_SECRET", secret, "--env-file", ".env.production"]

    const child = spawn(command, args, {
      cwd: convexBackendRoot,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      reject(new Error(`convex env set failed (${code}): ${(stderr || stdout).slice(0, 800)}`))
    })
  })
}

async function main() {
  const convexEnvRaw = await readFile(convexEnvFile, "utf8")
  const nestEnvRaw = await readFile(nestEnvFile, "utf8")
  const convexEnv = parseEnv(convexEnvRaw)

  if (!convexEnv.CONVEX_SELF_HOSTED_URL || !convexEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    throw new Error("packages/backend/.env.production is missing CONVEX_SELF_HOSTED_URL or CONVEX_SELF_HOSTED_ADMIN_KEY")
  }

  const secret = randomBytes(32).toString("hex")
  const fp = fingerprint(secret)

  console.log(`Generated secret fingerprint: ${fp}`)
  console.log("Setting Convex production ETL_SECRET…")
  await runConvexEnvSet(secret, convexEnv)
  console.log("Convex ETL_SECRET updated.")

  let nextNest = upsertEnvLine(nestEnvRaw, "ETL_CONVEX_SECRET", secret)
  if (!/^ETL_ENABLED=/m.test(nextNest)) {
    nextNest = upsertEnvLine(nextNest, "ETL_ENABLED", "true")
  }
  await writeFile(nestEnvFile, nextNest, "utf8")
  console.log("Updated api-survey-apps/.env.production ETL_CONVEX_SECRET (+ ETL_ENABLED if missing).")

  const copied = copyToClipboard(secret)
  console.log(
    copied
      ? "Secret is on your clipboard (not shown)."
      : "Clipboard unavailable — read ETL_CONVEX_SECRET from .env.production for Dokploy."
  )

  console.log(`
NEXT — Dokploy must get the SAME value (containers do not auto-read this laptop file):

  1. Dokploy → Environment → set ETL_CONVEX_SECRET on BOTH api and worker
     (paste from clipboard; fingerprint must be ${fp})
  2. Restart/redeploy api + worker
  3. Watch worker logs at the next :00/:15/:30/:45 tick —
     fingerprint must change FROM de8124a51a82 TO ${fp}, and 401s must stop

Do NOT paste the secret into chat.
`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
