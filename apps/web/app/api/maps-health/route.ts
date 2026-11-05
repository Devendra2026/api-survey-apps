import { NextResponse } from "next/server"

type ProbeResult = { ok: true } | { ok: false; reason: "missing_key" | "embed_rejected" | "network_error" }

/** Key validity changes rarely; probing Google on every map mount (or anonymous call) wastes quota and latency. */
const SUCCESS_TTL_MS = 10 * 60_000
/** Re-check failures sooner so a fixed key recovers quickly. */
const FAILURE_TTL_MS = 60_000

let cached: { result: ProbeResult; expiresAt: number } | null = null
let inFlight: Promise<ProbeResult> | null = null

function statusFor(result: ProbeResult): number {
  if (result.ok) return 200
  return result.reason === "missing_key" ? 503 : 502
}

async function probeEmbedKey(apiKey: string): Promise<ProbeResult> {
  const url =
    `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent("28.6139,77.209")}&zoom=17`

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      headers: {
        // Mimic local browser embeds so referrer-restricted keys still validate in dev.
        Referer: process.env.APP_URL?.trim() || "http://localhost:3000/",
      },
    })
    const body = await res.text()
    const looksLikeError =
      body.includes("ApiNotActivatedMapError") ||
      body.includes("InvalidKeyMapError") ||
      body.includes("RefererNotAllowedMapError") ||
      body.includes("REQUEST_DENIED") ||
      body.includes("The provided API key is invalid") ||
      (body.includes("The Google Maps Embed API") && body.includes("error"))

    return !res.ok || looksLikeError ? { ok: false, reason: "embed_rejected" } : { ok: true }
  } catch {
    return { ok: false, reason: "network_error" }
  }
}

/**
 * Server-side probe for the Maps Embed API key used by GisMap.
 * Cross-origin iframes cannot surface Google error pages to onError;
 * the client calls this route to decide whether to show the fallback UI.
 */
export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "missing_key" as const }, { status: 503 })
  }

  const now = Date.now()
  if (!cached || cached.expiresAt <= now) {
    // Collapse concurrent cache misses into one outbound request.
    inFlight ??= probeEmbedKey(apiKey).finally(() => {
      inFlight = null
    })
    const result = await inFlight
    cached = { result, expiresAt: now + (result.ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS) }
  }

  return NextResponse.json(cached.result, { status: statusFor(cached.result) })
}
