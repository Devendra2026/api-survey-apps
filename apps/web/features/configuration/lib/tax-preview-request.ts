/**
 * Stable cache key for tax preview inputs. Returns null when required fields are missing.
 * Used to debounce and dedupe identical preview requests.
 */
export function taxPreviewRequestKey(input: {
  wardId?: string
  assessmentYearId?: string
  areaSqFt: number
  roadWidthEntryId?: string
  constructionEntryId?: string
}): string | null {
  const wardId = input.wardId?.trim() ?? ""
  const assessmentYearId = input.assessmentYearId?.trim() ?? ""
  const roadWidthEntryId = input.roadWidthEntryId?.trim() ?? ""
  const constructionEntryId = input.constructionEntryId?.trim() ?? ""
  if (!wardId || !assessmentYearId || !roadWidthEntryId || !constructionEntryId) return null
  if (!Number.isFinite(input.areaSqFt) || input.areaSqFt < 0) return null
  return [wardId, assessmentYearId, String(input.areaSqFt), roadWidthEntryId, constructionEntryId].join("|")
}

export function parseTaxPreviewRequestKey(key: string): {
  wardId: string
  assessmentYearId: string
  areaSqFt: number
  roadWidthEntryId: string
  constructionEntryId: string
} {
  const [wardId, assessmentYearId, areaRaw, roadWidthEntryId, constructionEntryId] = key.split("|")
  return {
    wardId: wardId ?? "",
    assessmentYearId: assessmentYearId ?? "",
    areaSqFt: Number(areaRaw),
    roadWidthEntryId: roadWidthEntryId ?? "",
    constructionEntryId: constructionEntryId ?? "",
  }
}

/** Monotonic gate so only the latest scheduled preview may commit UI state. */
export function createRequestGenerationGate() {
  let generation = 0
  return {
    next(): number {
      generation += 1
      return generation
    },
    isCurrent(id: number): boolean {
      return id === generation
    },
    invalidate(): void {
      generation += 1
    },
  }
}
