"use client"

import { apiGetBlob } from "@/lib/api/client"
import { useEffect, useState } from "react"

export type PhotoDisplayStatus = "loading" | "ready" | "migrating" | "unavailable"

export function isPersistedPhotoId(id: string): boolean {
  return Boolean(id) && id !== "front" && id !== "side"
}

function isHttpUrl(url: string | undefined): boolean {
  return Boolean(url?.trim() && /^https?:\/\//i.test(url.trim()))
}

export function useAuthenticatedPhotoSrc(photo: {
  id: string
  url: string
  importStatus?: string | null
  objectKey?: string | null
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<PhotoDisplayStatus>("loading")

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const httpUrl = isHttpUrl(photo.url) ? photo.url.trim() : ""
    const pendingWithoutObject = photo.importStatus === "PENDING" && !photo.objectKey

    const load = async () => {
      if (pendingWithoutObject) {
        if (!cancelled) setStatus("migrating")
        return
      }

      if (isPersistedPhotoId(photo.id)) {
        try {
          const blob = await apiGetBlob(`/photos/${encodeURIComponent(photo.id)}/file`)
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          setSrc(objectUrl)
          setStatus("ready")
          return
        } catch {
          // Fall through to HTTPS fallback (durable CDN only — Convex URLs often 404).
        }
      }

      if (httpUrl) {
        if (!cancelled) {
          setSrc(httpUrl)
          setStatus("ready")
        }
        return
      }

      if (!cancelled) setStatus("unavailable")
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photo.id, photo.url, photo.importStatus, photo.objectKey])

  return { src, status, setStatus }
}
