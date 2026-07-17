"use client"

import { MapPin } from "lucide-react"
import { useEffect, useState } from "react"

type EmbedCoordsKey = string

function GisFallback({ coordinates, message }: { coordinates: string; message: string }) {
  return (
    <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-linear-to-br from-sky-100/80 via-indigo-50/60 to-violet-100/70 md:h-72 dark:border-white/10 dark:from-slate-900 dark:via-indigo-950/40 dark:to-violet-950/50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.18),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.14),transparent_40%)]" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <span className="relative flex size-14 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
          <span className="relative flex size-12 items-center justify-center rounded-full border border-white/60 bg-white/70 shadow-lg backdrop-blur-md dark:border-white/20 dark:bg-slate-900/70">
            <MapPin className="size-6 text-emerald-600 dark:text-emerald-400" />
          </span>
        </span>
        <p className="max-w-[16rem] text-center text-xs font-medium text-slate-700 dark:text-slate-200">
          {coordinates}
        </p>
      </div>
      <div className="absolute right-3 bottom-3 left-3 rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-[11px] font-medium text-amber-900 backdrop-blur-md dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-100">
        {message}
      </div>
    </div>
  )
}

/**
 * Interactive GIS map for survey coordinates. Renders a Google Maps Embed iframe (with an
 * auto marker at the coordinates) when a key and coordinates are available; otherwise shows
 * a styled fallback tile with an accurate reason.
 *
 * Cross-origin iframe onError does not fire for Google error pages, so we also probe
 * `/api/maps-health` and fall back if the Embed API rejects the key.
 */
export function GisMap({
  latitude,
  longitude,
  coordinates,
}: {
  latitude: number | null
  longitude: number | null
  coordinates: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasCoords = latitude != null && longitude != null
  const coordsKey: EmbedCoordsKey = `${latitude ?? ""}:${longitude ?? ""}:${apiKey ?? ""}`
  const [embedFailed, setEmbedFailed] = useState(false)
  const [trackedCoordsKey, setTrackedCoordsKey] = useState(coordsKey)

  if (trackedCoordsKey !== coordsKey) {
    setTrackedCoordsKey(coordsKey)
    setEmbedFailed(false)
  }

  useEffect(() => {
    if (!apiKey || !hasCoords) return

    let cancelled = false
    const controller = new AbortController()

    void (async () => {
      try {
        const res = await fetch("/api/maps-health", {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!cancelled && !res.ok) {
          setEmbedFailed(true)
        }
      } catch {
        // Network blips should not hide a working iframe.
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [apiKey, hasCoords, latitude, longitude])

  if (!hasCoords) {
    return <GisFallback coordinates={coordinates} message="GPS coordinates were not captured for this survey." />
  }

  if (!apiKey) {
    return (
      <GisFallback
        coordinates={coordinates}
        message="Google Maps key not configured — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the repo-root .env.local and restart the web server."
      />
    )
  }

  if (embedFailed) {
    return (
      <GisFallback
        coordinates={coordinates}
        message="Google Maps failed to load — enable Maps Embed API, check billing, and verify HTTP referrer restrictions (localhost:3000 and 127.0.0.1:3000) on the API key."
      />
    )
  }

  const query = `${latitude},${longitude}`
  const embedSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}&zoom=17`
  const mapsLink = `https://www.google.com/maps?q=${encodeURIComponent(query)}`

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-white/40 md:h-72 dark:border-white/10">
      <iframe
        title="GIS location"
        src={embedSrc}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onError={() => setEmbedFailed(true)}
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="pointer-events-auto rounded-lg border border-white/60 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-slate-900/85 dark:text-slate-200">
          {coordinates}
        </span>
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white dark:border-white/15 dark:bg-slate-900/85 dark:text-emerald-300 dark:hover:bg-slate-900"
        >
          <MapPin className="size-3" />
          Open in Google Maps
        </a>
      </div>
    </div>
  )
}
