/**
 * Soft-warning evaluation for mixed-use floor classification.
 * Never throws — callers attach the returned warnings to API responses / QC UI.
 */

import { isOpenLandPropertyUse, sumBuiltUpArea, unusuallyHighBuiltUpThreshold } from "./floor-plot-area.js"

export const FLOOR_USAGE_WARNING_CODES = [
  "MIXED_USE_PROPERTY_USE_MISMATCH",
  "FLOOR_AREA_EXCEEDS_PLOT",
  "FLOOR_AREA_EXCEEDS_PLINTH",
  "FLOOR_AREA_UNUSUALLY_HIGH",
  "BUILT_UP_MISMATCH",
  "MISSING_FLOOR_AREA",
  "USAGE_FACTOR_MIXED_AMBIGUOUS",
  "OPEN_LAND_HAS_FLOORS",
] as const

export type FloorUsageWarningCode = (typeof FLOOR_USAGE_WARNING_CODES)[number]

export type FloorUsageWarning = {
  code: FloorUsageWarningCode
  severity: "warning"
  message: string
  floorPosition?: string
  usageFactor?: string
}

export type FloorUsageWarningFloorInput = {
  floorPosition: string
  usageFactor: string | null | undefined
  areaSqFt: number | null | undefined
}

export type FloorUsageWarningInput = {
  propertyUse?: string | null
  propertyType?: string | null
  plotAreaSqFt?: number | null
  plinthAreaSqFt?: number | null
  totalBuiltAreaSqFt?: number | null
  floors: FloorUsageWarningFloorInput[]
}

const AREA_TOLERANCE_SQ_FT = 0.01
const MIX_PROPERTY = "MIX_PROPERTY"
const USAGE_MIXED = "MIXED"

function warn(
  code: FloorUsageWarningCode,
  message: string,
  extra?: Pick<FloorUsageWarning, "floorPosition" | "usageFactor">
): FloorUsageWarning {
  return {
    code,
    severity: "warning",
    message,
    ...extra,
  }
}

function toFiniteArea(value: number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

/** Sum of areas that count toward plot / built-up (excludes OPEN_LAND position or usage). */
function sumCountableFloorAreas(floors: FloorUsageWarningFloorInput[]): number {
  return sumBuiltUpArea(floors)
}

function distinctUsageFactors(floors: FloorUsageWarningFloorInput[]): string[] {
  const set = new Set<string>()
  for (const floor of floors) {
    if (floor.usageFactor) set.add(floor.usageFactor)
  }
  return [...set]
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= AREA_TOLERANCE_SQ_FT
}

/**
 * Evaluate soft warnings for mixed-use floors and survey area consistency.
 * Does not enforce hard integrity rules (duplicates, negative areas).
 */
export function evaluateMixedUseFloorWarnings(input: FloorUsageWarningInput): FloorUsageWarning[] {
  const floors = input.floors ?? []
  const warnings: FloorUsageWarning[] = []

  if (isOpenLandPropertyUse(input.propertyUse) && floors.length > 0) {
    warnings.push(
      warn(
        "OPEN_LAND_HAS_FLOORS",
        "Property Use is OPEN_LAND but floor rows still exist. Clear floors so built-up stays N/A."
      )
    )
  }

  if (floors.length === 0) {
    return warnings
  }

  const usages = distinctUsageFactors(floors)
  if (usages.length >= 2 && input.propertyUse !== MIX_PROPERTY && !isOpenLandPropertyUse(input.propertyUse)) {
    warnings.push(
      warn(
        "MIXED_USE_PROPERTY_USE_MISMATCH",
        `Floors use multiple usage factors (${usages.join(", ")}). Consider setting Property Use to MIX_PROPERTY.`
      )
    )
  }

  const countableAreaSum = sumCountableFloorAreas(floors)
  const plot = toFiniteArea(input.plotAreaSqFt)
  if (plot != null && countableAreaSum > unusuallyHighBuiltUpThreshold(plot) + AREA_TOLERANCE_SQ_FT) {
    warnings.push(
      warn(
        "FLOOR_AREA_UNUSUALLY_HIGH",
        `Total built-up (${countableAreaSum} sq ft) is unusually high vs plot (${plot} sq ft). Confirm multi-story areas are correct.`
      )
    )
  }

  const storedBuilt = toFiniteArea(input.totalBuiltAreaSqFt)
  if (storedBuilt != null && !nearlyEqual(storedBuilt, countableAreaSum)) {
    warnings.push(
      warn(
        "BUILT_UP_MISMATCH",
        `Stored built-up area (${storedBuilt} sq ft) does not match sum of floor areas (${countableAreaSum} sq ft).`
      )
    )
  }

  const anyNumericArea = floors.some((f) => toFiniteArea(f.areaSqFt) != null)
  const byPosition = new Map<string, FloorUsageWarningFloorInput[]>()
  for (const floor of floors) {
    const list = byPosition.get(floor.floorPosition) ?? []
    list.push(floor)
    byPosition.set(floor.floorPosition, list)
  }

  // Per floorPosition: countable footprint must not exceed plot/plinth (soft).
  const plinth = toFiniteArea(input.plinthAreaSqFt)
  for (const [floorPosition, rows] of byPosition) {
    const floorTotal = sumCountableFloorAreas(rows)
    if (plot != null && floorTotal > plot + AREA_TOLERANCE_SQ_FT) {
      warnings.push(
        warn(
          "FLOOR_AREA_EXCEEDS_PLOT",
          `Total area on this floor exceeds plot area (${floorTotal} sq ft on ${floorPosition} > ${plot} sq ft plot).`,
          { floorPosition }
        )
      )
    }
    if (plinth != null && floorTotal > plinth + AREA_TOLERANCE_SQ_FT) {
      warnings.push(
        warn(
          "FLOOR_AREA_EXCEEDS_PLINTH",
          `Total area on this floor exceeds plinth area (${floorTotal} sq ft on ${floorPosition} > ${plinth} sq ft plinth).`,
          { floorPosition }
        )
      )
    }
  }

  for (const floor of floors) {
    if (toFiniteArea(floor.areaSqFt) != null) continue
    const siblings = byPosition.get(floor.floorPosition) ?? []
    const mixedOnFloor = new Set(siblings.map((s) => s.usageFactor).filter(Boolean)).size >= 2
    if (mixedOnFloor || anyNumericArea) {
      warnings.push(
        warn(
          "MISSING_FLOOR_AREA",
          `Floor ${floor.floorPosition}${floor.usageFactor ? ` (${floor.usageFactor})` : ""} is missing area (sq ft).`,
          {
            floorPosition: floor.floorPosition,
            usageFactor: floor.usageFactor ?? undefined,
          }
        )
      )
    }
  }

  for (const [floorPosition, rows] of byPosition) {
    const factors = new Set(rows.map((r) => r.usageFactor).filter(Boolean) as string[])
    if (!factors.has(USAGE_MIXED)) continue
    const otherFactors = [...factors].filter((f) => f !== USAGE_MIXED)
    if (otherFactors.length === 0) continue
    for (const row of rows) {
      if (row.usageFactor !== USAGE_MIXED) continue
      warnings.push(
        warn(
          "USAGE_FACTOR_MIXED_AMBIGUOUS",
          `Floor ${floorPosition} has Usage Factor MIXED alongside split usages (${otherFactors.join(", ")}). Prefer split rows only.`,
          { floorPosition, usageFactor: USAGE_MIXED }
        )
      )
    }
  }

  return warnings
}
