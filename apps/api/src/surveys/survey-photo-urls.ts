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
    trimmed.startsWith("etah-images/") ||
    (!trimmed.includes("://") && trimmed.includes("/"))
  )
}

export function isConvexHostedUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  try {
    const host = new URL(trimmed).hostname.toLowerCase()
    return (
      host === "convex.cloud" ||
      host === "convex.site" ||
      host.endsWith(".convex.cloud") ||
      host.endsWith(".convex.site")
    )
  } catch {
    return /convex\.(cloud|site)/i.test(trimmed)
  }
}

function durableHttpsUrl(raw: RawPhoto | undefined, photo: SurveyPhotoDto): string | null {
  const candidates = [raw?.sourceUrl, raw?.url, photo.url]
  for (const candidate of candidates) {
    if (!isHttpUrl(candidate)) continue
    const trimmed = candidate!.trim()
    if (isConvexHostedUrl(trimmed)) continue
    return trimmed
  }
  return null
}

function anyHttpsUrl(raw: RawPhoto | undefined, photo: SurveyPhotoDto): string | null {
  if (raw && isHttpUrl(raw.sourceUrl)) return raw.sourceUrl!.trim()
  if (raw && isHttpUrl(raw.url)) return raw.url!.trim()
  if (isHttpUrl(photo.url)) return photo.url.trim()
  return null
}

/**
 * Prefer a signed URL from objectKey (durable MinIO/S3). Convex getUrl snapshots expire
 * and must not win when an objectKey exists. HTTPS sourceUrl is used only for true CDNs
 * or pending imports with no stored object.
 */
export async function refreshSurveyPhotoUrls<T extends PhotoDetail>(
  storageService: StorageService,
  detail: T,
  rawPhotos: ReadonlyArray<RawPhoto>,
  logger?: { warn: (message: string) => void },
  expiresInSeconds = 3600
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
      const objectKey = raw?.objectKey ?? photo.objectKey ?? null

      if (objectKey && storageReady) {
        try {
          const url = await storageService.getPresignedDownloadUrl(objectKey, expiresInSeconds)
          return { ...photo, url, importStatus, objectKey }
        } catch (err) {
          logger?.warn(`Failed to refresh signed URL for photo=${photo.id}: ${String(err)}`)
          return { ...photo, url: "", importStatus, objectKey }
        }
      }

      const durable = durableHttpsUrl(raw, photo)
      if (durable) {
        return { ...photo, url: durable, importStatus, objectKey }
      }

      if (!objectKey) {
        const fallback = anyHttpsUrl(raw, photo)
        if (fallback) {
          return { ...photo, url: fallback, importStatus, objectKey }
        }
      }

      if (looksLikeStorageKey(photo.url) || looksLikeStorageKey(raw?.url)) {
        return { ...photo, url: "", importStatus, objectKey }
      }

      return { ...photo, importStatus, objectKey }
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
