import { formatExportParcel, formatExportUnitNumber } from "@workspace/validation"
import type { PhotoExportRow, SurveyExportBundle } from "./types.js"

/** S3 SigV4 maximum. Excel links expire; the bucket stays private. */
export const PHOTO_EXPORT_URL_TTL_SECONDS = 604_800

export const PARCEL_IMAGES_SHEET_NAME = "Parcel Images"

export const PARCEL_IMAGE_HEADERS = [
  "Property ID",
  "Ward Name",
  "Ward Number",
  "Parcel No",
  "Unit No",
  "Image Type",
  "Image Name",
  "Image URL",
] as const

const PHOTO_TYPE_LABELS: Record<string, string> = {
  FRONT: "Front View",
  SIDE: "Side View",
  INSIDE: "Inside View",
  DOCUMENT: "Document",
}

export function labelPhotoType(photoType: string): string {
  const key = photoType.trim().toUpperCase()
  return PHOTO_TYPE_LABELS[key] ?? photoType
}

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false
  return /^https:\/\//i.test(value.trim())
}

/** Convex getUrl path: /api/storage/{storageId} (any host, including custom domains). */
const CONVEX_STORAGE_PATH = /^\/api\/storage\/[^/]+\/?$/i

export function isConvexHostedUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    if (
      host === "convex.cloud" ||
      host === "convex.site" ||
      host.endsWith(".convex.cloud") ||
      host.endsWith(".convex.site")
    ) {
      return true
    }
    // Custom Convex HTTP domain (e.g. api.sdvedutech.in/api/storage/{id})
    return CONVEX_STORAGE_PATH.test(parsed.pathname)
  } catch {
    return /convex\.(cloud|site)/i.test(trimmed) || /\/api\/storage\/[^/?#]+/i.test(trimmed)
  }
}

export function looksLikeStorageKey(value: string | null | undefined): boolean {
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

export function resolveStoredObjectKey(photo: {
  objectKey?: string | null
  url?: string | null
  sourceUrl?: string | null
}): string | null {
  if (photo.objectKey?.trim() && looksLikeStorageKey(photo.objectKey)) return photo.objectKey.trim()
  if (looksLikeStorageKey(photo.url)) return photo.url!.trim()
  if (looksLikeStorageKey(photo.sourceUrl)) return photo.sourceUrl!.trim()
  if (photo.objectKey?.trim() && !isHttpsUrl(photo.objectKey) && !/^https?:\/\//i.test(photo.objectKey.trim())) {
    return photo.objectKey.trim()
  }
  return null
}

function durableHttps(photo: PhotoExportRow): string | null {
  for (const candidate of [photo.sourceUrl, photo.url]) {
    if (!candidate) continue
    const trimmed = candidate.trim()
    if (!isHttpsUrl(trimmed)) continue
    if (isConvexHostedUrl(trimmed)) continue
    if (looksLikeStorageKey(trimmed)) continue
    return trimmed
  }
  return null
}

export function parcelImageName(photo: PhotoExportRow): string {
  const key = photo.objectKey?.trim() || resolveStoredObjectKey(photo)
  if (key) {
    const base = key.split("/").pop()?.trim()
    if (base) return base
  }
  const id = photo.id?.trim()
  if (id) return `${photo.photoType}-${id}`
  return photo.photoType
}

/** Prefer a pre-resolved signed URL. Never emit Convex hosts, storage keys, or secrets. */
export function resolveParcelImageUrl(photo: PhotoExportRow): string {
  const signed = photo.exportUrl?.trim()
  if (signed && isHttpsUrl(signed) && !isConvexHostedUrl(signed)) return signed
  return durableHttps(photo) ?? ""
}

export function toParcelImageRows(row: SurveyExportBundle): string[][] {
  const photos = row.photos ?? []
  if (photos.length === 0) return []

  const wardNumber = (row.ward?.wardNumber ?? row.wardNumber ?? "").trim()
  const wardName = (row.ward?.wardName ?? "").trim()
  const propertyId = (row.propertyId ?? "").trim()
  const parcelNo = formatExportParcel(row.parcelNumber)
  const unitNo = formatExportUnitNumber(row.unitSubNo)

  return photos.map((photo) => [
    propertyId,
    wardName,
    wardNumber,
    parcelNo,
    unitNo,
    labelPhotoType(photo.photoType),
    parcelImageName(photo),
    resolveParcelImageUrl(photo),
  ])
}

export async function withParcelImageExportUrls<T extends { photos: PhotoExportRow[] }>(
  row: T,
  signObjectKey: (objectKey: string) => Promise<string | null>
): Promise<T> {
  if (!row.photos.length) return row
  const photos = await Promise.all(
    row.photos.map(async (photo) => {
      const objectKey = resolveStoredObjectKey(photo)
      let exportUrl: string | null = null
      if (objectKey) {
        try {
          exportUrl = await signObjectKey(objectKey)
        } catch {
          exportUrl = null
        }
      }
      if (!exportUrl || !isHttpsUrl(exportUrl) || isConvexHostedUrl(exportUrl)) {
        exportUrl = durableHttps(photo)
      }
      return { ...photo, objectKey: objectKey ?? photo.objectKey ?? null, exportUrl }
    })
  )
  return { ...row, photos }
}
