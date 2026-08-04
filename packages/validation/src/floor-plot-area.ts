/**
 * Plot / footprint rules for floor area checks (hard fail + soft warnings).
 *
 * Countable built-up = sum of floor row areas only (never add survey.totalBuiltAreaSqFt —
 * that field is derived from the same rows and would double-count).
 *
 * - Per floorPosition footprint: sum of countable areas on that position ≤ plot (hard).
 * - Survey-wide FAR hard caps are not enforced; soft "unusually high" uses plot × 3.
 * - OPEN_LAND (floorPosition or usageFactor) is excluded from footprint and built-up sums.
 * - PAKKA_BUILDING_WITH_RCC_ROOF is a construction type, not a terrace — always countable.
 */

const OPEN_LAND = "OPEN_LAND"

/** Soft threshold: total countable built-up above plot × this factor is unusually high. */
export const UNUSUALLY_HIGH_BUILT_UP_MULTIPLIER = 3

export function isOpenLandPropertyUse(propertyUse: string | null | undefined): boolean {
  return propertyUse === OPEN_LAND
}

export function isExcludedFromPlotAreaCheck(
  floorPosition: string | null | undefined,
  usageFactor: string | null | undefined
): boolean {
  return floorPosition === OPEN_LAND || usageFactor === OPEN_LAND
}

/** Area that counts toward plot footprint / built-up; 0 when OPEN_LAND. */
export function countableFloorAreaForPlotCheck(
  areaSqFt: number,
  floorPosition: string | null | undefined,
  usageFactor: string | null | undefined
): number {
  if (isExcludedFromPlotAreaCheck(floorPosition, usageFactor)) return 0
  return Number.isFinite(areaSqFt) ? areaSqFt : 0
}

export type FloorAreaRow = {
  floorPosition: string | null | undefined
  usageFactor: string | null | undefined
  areaSqFt: number | null | undefined
}

function toFiniteArea(value: number | null | undefined): number {
  if (value == null) return 0
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return value
}

/** Sum of countable floor areas (excludes OPEN_LAND position/usage). */
export function sumBuiltUpArea(floors: FloorAreaRow[]): number {
  let sum = 0
  for (const floor of floors) {
    sum += countableFloorAreaForPlotCheck(toFiniteArea(floor.areaSqFt), floor.floorPosition, floor.usageFactor)
  }
  return sum
}

/** Soft-warning ceiling: plot × UNUSUALLY_HIGH_BUILT_UP_MULTIPLIER. */
export function unusuallyHighBuiltUpThreshold(plotAreaSqFt: number): number {
  return plotAreaSqFt * UNUSUALLY_HIGH_BUILT_UP_MULTIPLIER
}
