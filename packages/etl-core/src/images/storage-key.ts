import { ETL_PREFIX, type PhotoSlot } from "../domain/types.js"

export interface StorageKeyInput {
  districtCode: string
  wardNo: string
  legacySurveyId: string
  slot: PhotoSlot
  /** File extension without dot, e.g. webp | jpg | png */
  extension: string
}

/**
 * Builds object key:
 * etah-images/district-{districtCode}/ward-{wardNo}/{legacySurveyId}/{slot}.{ext}
 */
export function buildStorageKey(input: StorageKeyInput): string {
  const district = sanitizeSegment(input.districtCode)
  const ward = sanitizeSegment(input.wardNo)
  const surveyId = sanitizeSegment(input.legacySurveyId)
  const ext = sanitizeExtension(input.extension)
  return `${ETL_PREFIX}/district-${district}/ward-${ward}/${surveyId}/${input.slot}.${ext}`
}

function sanitizeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown"
}

function sanitizeExtension(ext: string): string {
  const cleaned = ext.trim().toLowerCase().replace(/^\./, "")
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(cleaned)) {
    return cleaned === "jpeg" ? "jpg" : cleaned
  }
  return "bin"
}

export function extensionFromMime(mimeType: string): string {
  const mime = mimeType.toLowerCase().split(";")[0]?.trim() ?? ""
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/heic":
    case "image/heif":
      return "heic"
    default:
      return "bin"
  }
}
