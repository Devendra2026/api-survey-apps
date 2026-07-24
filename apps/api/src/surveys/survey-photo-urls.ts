import type { StorageService } from "../storage/storage.service.js"
import type { SurveyPhotoDto } from "./dto/survey-view.dto.js"

type PhotoDetail = {
  photos: SurveyPhotoDto[]
  frontPhotoUrl: string | null
  sidePhotoUrl: string | null
}

type RawPhoto = {
  id: string
  objectKey: string | null
  sourceUrl?: string | null
  url?: string | null
  importStatus?: string | null
}

function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return /^https?:\/\//i.test(value.trim())
}

function looksLikeStorageKey(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return false
  return (
    trimmed.startsWith("uploads/") ||
    trimmed.startsWith("surveys/") ||
    (!trimmed.includes("://") && trimmed.includes("/"))
  )
}

function httpsFallback(raw: RawPhoto | undefined, photo: SurveyPhotoDto): string | null {
  if (raw && isHttpUrl(raw.sourceUrl)) return raw.sourceUrl!.trim()
  if (raw && isHttpUrl(raw.url)) return raw.url!.trim()
  if (isHttpUrl(photo.url)) return photo.url.trim()
  return null
}

/**
 * Prefer HTTPS sourceUrl for display when present (import / CDN links work in the browser).
 * Otherwise mint a signed URL from objectKey. Never expose bare storage keys as img src.
 */
export async function refreshSurveyPhotoUrls<T extends PhotoDetail>(
  storageService: StorageService,
  detail: T,
  rawPhotos: ReadonlyArray<RawPhoto>,
  logger?: { warn: (message: string) => void }
): Promise<T> {
  if (detail.photos.length === 0) {
    return detail
  }

  const rawById = new Map(rawPhotos.map((photo) => [photo.id, photo]))
  const storageReady = storageService.isConfigured()

  const photos = await Promise.all(
    detail.photos.map(async (photo) => {
      const raw = rawById.get(photo.id)
      const importStatus = raw?.importStatus ?? photo.importStatus ?? null
      const objectKey = raw?.objectKey ?? null
      const fallback = httpsFallback(raw, photo)

      // Imported photos keep a durable public HTTPS sourceUrl — prefer it for <img src>.
      if (fallback) {
        return { ...photo, url: fallback, importStatus }
      }

      if (objectKey && storageReady) {
        try {
          const url = await storageService.getPresignedDownloadUrl(objectKey, 3600)
          return { ...photo, url, importStatus }
        } catch (err) {
          logger?.warn(`Failed to refresh signed URL for photo=${photo.id}: ${String(err)}`)
          return { ...photo, url: "", importStatus }
        }
      }

      if (looksLikeStorageKey(photo.url) || looksLikeStorageKey(raw?.url)) {
        return { ...photo, url: "", importStatus }
      }

      return { ...photo, importStatus }
    })
  )

  const front = photos.find((photo) => photo.photoType === "FRONT")
  const side = photos.find((photo) => photo.photoType === "SIDE")

  return {
    ...detail,
    photos,
    frontPhotoUrl: front?.url || detail.frontPhotoUrl,
    sidePhotoUrl: side?.url || detail.sidePhotoUrl,
  }
}
