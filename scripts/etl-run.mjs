#!/usr/bin/env node
/**
 * Local ETL runner — calls Nest /etl APIs (Postgres + MinIO via worker).
 *
 * Usage (from api-survey-apps):
 *   pnpm etl:run full --batch-size 20
 *   pnpm etl:run incremental
 *   pnpm etl:run status
 *   pnpm etl:run report --job-id <id>
 *   pnpm etl:run validate
 *   pnpm etl:run retry
 *   pnpm etl:run full --watch
 *
 * Auth (dev):
 *   ETL_DEV_CLERK_USER_ID=<clerk user id>   # or BOOTSTRAP_ADMIN_CLERK_USER_IDS first id
 *   ALLOW_DEV_AUTH=true on the API
 *
 * Or production-style:
 *   ETL_BEARER_TOKEN=<clerk jwt>
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

loadEnvFiles([
  resolve(root, ".env.local"),
  resolve(root, ".env"),
  resolve(root, ".env.development"),
  resolve(root, "apps/api/.env.local"),
  resolve(root, "apps/api/.env.development"),
])

const args = process.argv.slice(2)
const command = args[0] ?? "status"
const flags = parseFlags(args.slice(1))

const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
)
const bearer =
  process.env.ETL_BEARER_TOKEN ||
  process.env.CLERK_JWT ||
  flags.token ||
  buildDevBearer()

if (!bearer) {
  console.error(
    "Missing auth. Set ETL_DEV_CLERK_USER_ID (or BOOTSTRAP_ADMIN_CLERK_USER_IDS) with ALLOW_DEV_AUTH=true,\n" +
    "or set ETL_BEARER_TOKEN to a Clerk JWT."
  )
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${bearer}`,
  "Content-Type": "application/json",
  Accept: "application/json",
}

try {
  switch (command) {
    case "full":
    case "full-migration":
      await startAndMaybeWatch("full-migration", {
        batchSize: numberFlag(flags["batch-size"], Number(process.env.ETL_BATCH_SIZE) || 100),
        force: Boolean(flags.force),
      })
      break
    case "incremental":
    case "incremental-sync":
      await startAndMaybeWatch("incremental-sync", {
        batchSize: numberFlag(flags["batch-size"], Number(process.env.ETL_BATCH_SIZE) || 100),
      })
      break
    case "retry":
    case "retry-failed":
      await startAndMaybeWatch("retry-failed", {
        maxRetries: numberFlag(flags["max-retries"], Number(process.env.ETL_MAX_RETRIES) || 5),
      })
      break
    case "validate":
      await startAndMaybeWatch("validate", {})
      break
    case "status":
      console.log(JSON.stringify(await api("GET", "/etl/status"), null, 2))
      break
    case "preflight": {
      const result = await api("GET", "/etl/preflight")
      console.log(JSON.stringify(result, null, 2))
      if (!result?.ok) process.exit(1)
      break
    }
    case "reap":
    case "reap-stale":
      console.log(JSON.stringify(await api("POST", "/etl/reap-stale", {}), null, 2))
      break
    case "report": {
      const jobId = flags["job-id"] || flags.jobId
      if (!jobId) {
        console.error("Usage: pnpm etl:run report --job-id <id>")
        process.exit(1)
      }
      console.log(JSON.stringify(await api("GET", `/etl/report?jobId=${encodeURIComponent(jobId)}`), null, 2))
      break
    }
    case "jobs":
      console.log(
        JSON.stringify(
          await api("GET", `/etl/jobs?limit=${numberFlag(flags.limit, 20)}`),
          null,
          2
        )
      )
      break
    case "help":
    case "--help":
    case "-h":
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

async function startAndMaybeWatch(path, body) {
  const started = await api("POST", `/etl/${path}`, body)
  console.log(JSON.stringify(started, null, 2))
  const jobId = started?.jobId ?? started?.data?.jobId
  if (flags.watch && jobId) {
    await watchJob(jobId)
  } else if (jobId) {
    console.log(`\nPoll: pnpm etl:run report --job-id ${jobId}`)
    console.log(`Or:   pnpm etl:run status`)
  }
}

async function watchJob(jobId) {
  console.log(`\nWatching job ${jobId}…`)
  for (; ;) {
    const report = await api("GET", `/etl/report?jobId=${encodeURIComponent(jobId)}`)
    const status = report?.status ?? report?.data?.status
    const stats = report?.stats ?? report?.data?.stats
    process.stdout.write(`\r[${new Date().toISOString()}] status=${status} stats=${JSON.stringify(stats ?? {})}   `)
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      console.log("\n")
      console.log(JSON.stringify(report, null, 2))
      if (status !== "COMPLETED") process.exit(1)
      return
    }
    await sleep(3000)
  }
}

async function api(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body && method !== "GET" ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  // Nest ResponseTransformInterceptor may wrap as { data: ... }
  const payload = json?.data !== undefined && json?.success !== undefined ? json.data : json
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 800)}`)
  }
  return payload
}

function buildDevBearer() {
  const fromEnv =
    process.env.ETL_DEV_CLERK_USER_ID?.trim() ||
    process.env.BOOTSTRAP_ADMIN_CLERK_USER_IDS?.split(",")[0]?.trim() ||
    process.env.SEED_ADMIN_CLERK_USER_ID?.trim()
  if (!fromEnv) return undefined
  return `dev:${fromEnv}`
}

function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith("--")) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function numberFlag(value, fallback) {
  if (value == null || value === true) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function loadEnvFiles(paths) {
  for (const file of paths) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, "utf8")
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

function printHelp() {
  console.log(`ETL runner

  pnpm etl:run full [--batch-size 20] [--force] [--watch]
  pnpm etl:run incremental [--batch-size 20] [--watch]
  pnpm etl:run retry [--max-retries 5] [--watch]
  pnpm etl:run validate [--watch]
  pnpm etl:run status
  pnpm etl:run preflight            # diagnose Convex URL + shared secret
  pnpm etl:run reap-stale           # close abandoned QUEUED/RUNNING jobs
  pnpm etl:run report --job-id <id>
  pnpm etl:run jobs [--limit 20]

Requires API+worker running (pnpm dev) and Docker Postgres/Redis/MinIO.
`)
}
