#!/usr/bin/env node
/**
 * ETL shared-secret helper.
 *
 * The secret must be byte-identical on both sides of the Convex → Nest ETL link:
 * Convex `ETL_SECRET` and api/worker `ETL_CONVEX_SECRET`. This script generates
 * and verifies it without ever printing the value, so it cannot leak into a
 * terminal transcript, a chat, or shell history.
 *
 * Usage:
 *   pnpm etl:secret generate          # new secret → clipboard, prints fingerprint only
 *   pnpm etl:secret fingerprint       # fingerprint the secret on stdin
 *   pnpm etl:secret fingerprint --env ETL_CONVEX_SECRET
 */
import { spawnSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { platform } from "node:process"

const [command = "help", ...rest] = process.argv.slice(2)

switch (command) {
  case "generate":
    generate()
    break
  case "fingerprint":
    await fingerprintCommand(rest)
    break
  default:
    printHelp()
    process.exit(command === "help" ? 0 : 1)
}

/**
 * Same 12-hex label the api and Convex both log, so three independently held
 * copies of the secret can be compared without any of them being revealed.
 */
function fingerprint(value) {
  if (value === "") return "empty"
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12)
}

function generate() {
  const secret = randomBytes(32).toString("hex")
  const copied = copyToClipboard(secret)

  console.log(`fingerprint: ${fingerprint(secret)}`)
  console.log(copied ? "The secret is on your clipboard (not shown above)." : "Could not reach a clipboard tool.")
  console.log(`
Paste the same value into both places, then redeploy:

  1. Convex — from sdv-monorepo-apps/packages/backend:
       npx convex env set ETL_SECRET <paste>
     (or the Convex dashboard, which keeps it out of shell history)

  2. Dokploy — ETL_CONVEX_SECRET on BOTH the api and worker services.
     Avoid '#' anywhere in an env file: it starts a comment and truncates the value.

  3. Verify — the fingerprint above must match 'secretFingerprint' from:
       pnpm etl:run preflight
`)

  if (!copied) {
    console.log("Re-run once a clipboard tool is available, or generate the value directly on the host.")
    process.exit(1)
  }
}

async function fingerprintCommand(args) {
  const envIndex = args.indexOf("--env")
  if (envIndex !== -1) {
    const name = args[envIndex + 1]
    if (!name) {
      console.error("Usage: pnpm etl:secret fingerprint --env <VAR_NAME>")
      process.exit(1)
    }
    const value = process.env[name]
    if (value === undefined) {
      console.error(`${name} is not set in this environment`)
      process.exit(1)
    }
    // Trimmed to match both runtimes, which ignore surrounding whitespace.
    console.log(`${name}: ${fingerprint(value.trim())}`)
    return
  }

  const piped = await readStdin()
  if (piped === null) {
    console.error("No input. Pipe the secret in, or pass --env <VAR_NAME>.")
    process.exit(1)
  }
  console.log(`fingerprint: ${fingerprint(piped.trim())}`)
}

function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => resolve(data))
    process.stdin.on("error", reject)
  })
}

/** Writes via stdin so the secret never appears in argv or process listings. */
function copyToClipboard(value) {
  const tools =
    platform === "win32"
      ? [["clip", []]]
      : platform === "darwin"
        ? [["pbcopy", []]]
        : [
          ["wl-copy", []],
          ["xclip", ["-selection", "clipboard"]],
          ["xsel", ["--clipboard", "--input"]],
        ]

  for (const [bin, args] of tools) {
    const result = spawnSync(bin, args, { input: value })
    if (!result.error && result.status === 0) return true
  }
  return false
}

function printHelp() {
  console.log(`ETL shared-secret helper — never prints the secret itself

  pnpm etl:secret generate                          new value → clipboard + fingerprint
  pnpm etl:secret fingerprint --env ETL_CONVEX_SECRET   fingerprint a configured value
  echo -n '<value>' | pnpm etl:secret fingerprint    fingerprint a value from stdin

Compare the fingerprint with 'secretFingerprint' from 'pnpm etl:run preflight'
and with 'expectedFingerprint' in the Convex function logs.
`)
}
