export type FloorDraft = {
  position: string | null
  area: number | null
  usageFactor: string | null
  usageType: string | null
  construction: string | null
}

/** Names the required floor fields that are still empty. Area must be a number ≥ 0. */
export function missingFloorFields(draft: FloorDraft): string[] {
  const missing: string[] = []
  if (!draft.position) missing.push("Floor no. is required.")
  if (draft.area === null || !Number.isFinite(draft.area) || draft.area < 0) {
    missing.push("Floor area is required.")
  }
  if (!draft.usageFactor) missing.push("Usage factor is required.")
  if (!draft.usageType) missing.push("Usage type is required.")
  if (!draft.construction) missing.push("Construction type is required.")
  return missing
}

export type FloorIdentity = {
  id: string
  floorPosition: string
  usageFactor: string
  constructionType: string
}

/** Matches the floor unique key `(surveyId, floorPosition, usageFactor, constructionType)`. */
export function isDuplicateFloor(
  floors: readonly FloorIdentity[],
  draft: { id: string | null; floorPosition: string; usageFactor: string; constructionType: string }
): boolean {
  return floors.some(
    (floor) =>
      floor.id !== draft.id &&
      floor.floorPosition === draft.floorPosition &&
      floor.usageFactor === draft.usageFactor &&
      floor.constructionType === draft.constructionType
  )
}
