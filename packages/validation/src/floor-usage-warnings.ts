/**
 * Soft-warning evaluation for mixed-use floor classification.
 * Never throws — callers attach the returned warnings to API responses / QC UI.
 */

export const FLOOR_USAGE_WARNING_CODES = [
  "MIXED_USE_PROPERTY_USE_MISMATCH",
  "FLOOR_AREA_EXCEEDS_PLOT",
  "FLOOR_AREA_EXCEEDS_PLINTH",
  "BUILT_UP_MISMATCH",
  "MISSING_FLOOR_AREA",
  "USAGE_FACTOR_MIXED_AMBIGUOUS",
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

function sumFloorAreas(floors: FloorUsageWarningFloorInput[]): number {
  let sum = 0
  for (const floor of floors) {
    const area = toFiniteArea(floor.areaSqFt)
    if (area != null) sum += area
  }
  return sum
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

  if (floors.length === 0) {
    return warnings
  }

  const usages = distinctUsageFactors(floors)
  if (usages.length >= 2 && input.propertyUse !== MIX_PROPERTY) {
    warnings.push(
      warn(
        "MIXED_USE_PROPERTY_USE_MISMATCH",
        `Floors use multiple usage factors (${usages.join(", ")}). Consider setting Property Use to MIX_PROPERTY.`
      )
    )
  }

  const areaSum = sumFloorAreas(floors)
  const plot = toFiniteArea(input.plotAreaSqFt)
  if (plot != null && areaSum > plot + AREA_TOLERANCE_SQ_FT) {
    warnings.push(
      warn("FLOOR_AREA_EXCEEDS_PLOT", `Total floor area (${areaSum} sq ft) exceeds plot area (${plot} sq ft).`)
    )
  }

  const plinth = toFiniteArea(input.plinthAreaSqFt)
  if (plinth != null && areaSum > plinth + AREA_TOLERANCE_SQ_FT) {
    warnings.push(
      warn("FLOOR_AREA_EXCEEDS_PLINTH", `Total floor area (${areaSum} sq ft) exceeds plinth area (${plinth} sq ft).`)
    )
  }

  const storedBuilt = toFiniteArea(input.totalBuiltAreaSqFt)
  if (storedBuilt != null && !nearlyEqual(storedBuilt, areaSum)) {
    warnings.push(
      warn(
        "BUILT_UP_MISMATCH",
        `Stored built-up area (${storedBuilt} sq ft) does not match sum of floor areas (${areaSum} sq ft).`
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
