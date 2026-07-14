#!/usr/bin/env node
/**
 * One-shot monorepo health check for local turbo `pnpm dev`.
 * Verifies workspace packages build and expected HTTP ports respond.
 *
 * Usage: pnpm verify:dev
 * Optional: START_STACK=1 pnpm verify:dev  (expects stack already running by default)
 */
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const checks = []

function pass(label) {
  checks.push({ label, ok: true })
  console.log(`  ✓ ${label}`)
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail })
  console.error(`  ✗ ${label}${detail ? `\n    ${detail}` : ""}`)
}

function run(cmd) {
  return execSync(cmd, { cwd: root, stdio: "pipe", encoding: "utf8" })
}

console.log("\n🔍 SDV monorepo verify-dev\n")

// 1. Node / pnpm
try {
  const node = run("node -v").trim()
  const major = Number(node.replace(/^v/, "").split(".")[0])
  if (major < 22) fail(`Node ${node}`, "Need Node >= 22.12")
  else pass(`Node ${node}`)
} catch (e) {
  fail("Node available", String(e))
}

try {
  const pnpm = run("pnpm -v").trim()
  pass(`pnpm ${pnpm}`)
} catch (e) {
  fail("pnpm available", String(e))
}

// 2. Env files present (do not print secrets)
const envCandidates = [".env", ".env.local", ".env.development", "apps/web/.env.local", "packages/database/.env"]
const foundEnv = envCandidates.filter((p) => existsSync(resolve(root, p)))
if (foundEnv.length) pass(`Env files found (${foundEnv.join(", ")})`)
else fail("Env files", "No .env* found — copy .env.development.example")

// 3. Build library packages (includes validation)
try {
  console.log("\n📦 Building workspace libs…")
  run("pnpm exec turbo run build --filter=@workspace/validation --filter=@workspace/database --filter=@workspace/jobs --filter=@workspace/excel-reports")
  pass("@workspace packages build (validation, database, jobs, excel-reports)")
} catch (e) {
  fail("Library builds", e?.stdout?.toString?.() || e?.stderr?.toString?.() || String(e))
}

// 4. Confirm validation has no `dev` script (must use dev:watch)
try {
  const { readFileSync } = await import("node:fs")
  const pkg = JSON.parse(readFileSync(resolve(root, "packages/validation/package.json"), "utf8"))
  if (pkg.scripts?.dev) {
    fail("validation scripts", "Remove `dev` — use `dev:watch` only so turbo doesn't treat it as a service")
  } else if (pkg.scripts?.["dev:watch"] && pkg.scripts?.build) {
    pass("validation is a library (build + dev:watch, no service `dev`)")
  } else {
    fail("validation scripts", "Expected build + dev:watch")
  }
} catch (e2) {
  fail("validation package.json", String(e2))
}

// 5. Turbo dry-run should only persist api/web/worker for `pnpm dev`
try {
  const dry = run("pnpm exec turbo run dev --filter=api --filter=web --filter=worker --dry-run")
  const hasValidationDev = /@workspace\/validation#dev\b/.test(dry)
  const hasApi = /api#dev\b/.test(dry)
  const hasWeb = /web#dev\b/.test(dry)
  const hasWorker = /worker#dev\b/.test(dry)
  if (hasValidationDev) fail("turbo graph", "validation#dev still included — remove packages/validation scripts.dev")
  else if (hasApi && hasWeb && hasWorker) pass("turbo graph: api + web + worker only (services)")
  else fail("turbo graph", "Missing api/web/worker in filtered dry-run")
} catch (e) {
  fail("turbo dry-run", String(e))
}

// 6. Port probes (stack may already be running)
const ports = [
  { name: "web", port: 3000 },
  { name: "api", port: 4000 },
  { name: "worker", port: 4001 },
]

console.log("\n🌐 Port probes (ok if stack not started yet)…")
for (const { name, port } of ports) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) })
    pass(`${name} :${port} responded (${res.status})`)
  } catch {
    console.log(`  · ${name} :${port} not listening (start with pnpm dev)`)
  }
}

const failed = checks.filter((c) => !c.ok)
console.log(`\n${failed.length ? "❌" : "✅"} verify-dev finished — ${checks.filter((c) => c.ok).length}/${checks.length} checks passed\n`)
if (failed.length) {
  console.error("Failed checks:")
  for (const f of failed) console.error(` - ${f.label}${f.detail ? `: ${f.detail}` : ""}`)
  process.exit(1)
}
