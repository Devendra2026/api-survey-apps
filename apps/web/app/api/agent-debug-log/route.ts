import { NextResponse } from "next/server"
import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"

const INGEST = "http://127.0.0.1:7548/ingest/d4e91970-7ad5-429b-8326-a482939a5101"
const SESSION = "cb377d"

function logCandidates(): string[] {
  const cwd = process.cwd()
  return [
    path.join(cwd, ".cursor", `debug-${SESSION}.log`),
    path.join(cwd, "..", "..", ".cursor", `debug-${SESSION}.log`),
    path.join(cwd, "..", "..", "..", ".cursor", `debug-${SESSION}.log`),
  ]
}

/**
 * Same-origin debug ingest so HTTPS admin pages can log without mixed-content blocks
 * to http://127.0.0.1. Best-effort: writes local NDJSON when the Next process can see
 * the workspace .cursor folder, and forwards to the Cursor debug ingest when reachable.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const payload =
    typeof body === "object" && body !== null
      ? { sessionId: SESSION, ...(body as Record<string, unknown>), timestamp: Date.now() }
      : { sessionId: SESSION, message: String(body), timestamp: Date.now() }

  const line = `${JSON.stringify(payload)}\n`

  for (const file of logCandidates()) {
    try {
      await mkdir(path.dirname(file), { recursive: true })
      await appendFile(file, line, "utf8")
      break
    } catch {
      // try next candidate
    }
  }

  fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(payload),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
