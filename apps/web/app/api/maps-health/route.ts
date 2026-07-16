import { NextResponse } from "next/server"

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

  const url =
    `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent("28.6139,77.209")}&zoom=17`

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
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

    if (!res.ok || looksLikeError) {
      return NextResponse.json({ ok: false, reason: "embed_rejected" as const }, { status: 502 })
    }

    return NextResponse.json({ ok: true as const })
  } catch {
    return NextResponse.json({ ok: false, reason: "network_error" as const }, { status: 502 })
  }
}
