import type { StorageService } from "../storage/storage.service.js"
import type { SurveyPhotoDto } from "./dto/survey-view.dto.js"

type PhotoDetail = {
  photos: SurveyPhotoDto[]
  frontPhotoUrl: string | null
  sidePhotoUrl: string | null
}

/**
 * Stored photo URLs are short-lived presigned links that expire (default 900s), so a detail
 * response served later renders broken images. Regenerate a fresh signed URL per photo from
 * its `objectKey`. Photos without an `objectKey` (legacy/external URLs) or any storage failure
 * keep their original `url`. `frontPhotoUrl`/`sidePhotoUrl` are re-derived from the refreshed set.
 */
export async function refreshSurveyPhotoUrls<T extends PhotoDetail>(
  storageService: StorageService,
  detail: T,
  rawPhotos: ReadonlyArray<{ id: string; objectKey: string | null }>,
  logger?: { warn: (message: string) => void }
): Promise<T> {
  if (!storageService.isConfigured() || detail.photos.length === 0) {
    return detail
  }

  const objectKeyById = new Map(rawPhotos.map((photo) => [photo.id, photo.objectKey]))

  const photos = await Promise.all(
    detail.photos.map(async (photo) => {
      const objectKey = objectKeyById.get(photo.id)
      if (!objectKey) return photo
      try {
        const url = await storageService.getPresignedDownloadUrl(objectKey, 3600)
        return { ...photo, url }
      } catch (err) {
        logger?.warn(`Failed to refresh signed URL for photo=${photo.id}: ${String(err)}`)
        return photo
      }
    })
  )

  const front = photos.find((photo) => photo.photoType === "FRONT")
  const side = photos.find((photo) => photo.photoType === "SIDE")

  return {
    ...detail,
    photos,
    frontPhotoUrl: front?.url ?? detail.frontPhotoUrl,
    sidePhotoUrl: side?.url ?? detail.sidePhotoUrl,
  }
}
