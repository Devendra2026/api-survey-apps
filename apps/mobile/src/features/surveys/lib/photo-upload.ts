export type PhotoWrite =
  | { mode: "create" }
  | { mode: "replace"; photoId: string }

/**
 * Retake updates the existing photo row. A new slot creates one row.
 * Creating a second FRONT row is rejected by the API.
 */
export function photoWriteTarget(existingPhotoId: string | undefined): PhotoWrite {
  if (existingPhotoId) {
    return { mode: "replace", photoId: existingPhotoId }
  }
  return { mode: "create" }
}

/** One in-flight upload per photo slot. A ref holds this so a second tap cannot start another request. */
export function createPhotoSlotGuard(): {
  tryAcquire: (slot: string) => boolean
  release: (slot: string) => void
} {
  const busy = new Set<string>()
  return {
    tryAcquire(slot: string): boolean {
      if (busy.has(slot)) {
        return false
      }
      busy.add(slot)
      return true
    },
    release(slot: string): void {
      busy.delete(slot)
    },
  }
}

export function photoPreviewPath(photoId: string, objectKey?: string | null): string {
  const path = `/photos/${encodeURIComponent(photoId)}/file`
  if (!objectKey) {
    return path
  }
  return `${path}?v=${encodeURIComponent(objectKey)}`
}
