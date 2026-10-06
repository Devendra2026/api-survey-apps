import {
  isExcludedFromPlotAreaCheck,
  isOpenLandPropertyUse,
  sqFtToSqMeter,
  sqMeterToSqFt,
  sumBuiltUpArea,
} from "@workspace/validation"
import type { DecimalWire, SurveyPatch } from "../types.ts"

const AREA_COMPARE_EPSILON = 0.00005
const GROUND_FLOOR = "GROUND_FLOOR"

export type AreaFloor = {
  floorPosition: string
  usageFactor: string | null
  areaSqFt: DecimalWire
}

export type AreaUnit = "sqFt" | "sqMeter"

export type AreaPair = {
  sqFt: number | null
  sqMeter: number | null
}

export type AreaDraftParse =
  { kind: "empty" } | { kind: "pending"; value: number | null } | { kind: "invalid" } | { kind: "value"; value: number }

export type AreaSummary = {
  builtUpSqFt: number
  openLandSqFt: number
  builtUpFloorCount: number
  openLandFloorCount: number
}

export function measureNumber(value: DecimalWire): number | null {
  if (value === null) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function floorAreaNumber(value: DecimalWire): number {
  return measureNumber(value) ?? 0
}

export function sameArea(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right
  return Math.abs(left - right) < AREA_COMPARE_EPSILON
}

/**
 * Square feet in, canonical square meters out. Square meters in, convert to
 * square feet and then back through `sqFtToSqMeter` so the stored pair matches
 * the GIS factor. A typed meter value can shift by 0.0001.
 */
export function areaPairFromSource(source: AreaUnit, value: number | null): AreaPair {
  if (value === null || !Number.isFinite(value)) return { sqFt: null, sqMeter: null }
  if (source === "sqFt") return { sqFt: value, sqMeter: sqFtToSqMeter(value) ?? null }
  const sqFt = sqMeterToSqFt(value)
  if (sqFt === undefined) return { sqFt: null, sqMeter: null }
  return { sqFt, sqMeter: sqFtToSqMeter(sqFt) ?? null }
}

/** Empty clears the pair. A trailing dot keeps the digits already typed. */
export function parseAreaDraft(raw: string): AreaDraftParse {
  const trimmed = raw.trim().replace(/,/g, "")
  if (trimmed === "") return { kind: "empty" }
  if (trimmed === ".") return { kind: "pending", value: null }
  if (!/^\d+\.$/.test(trimmed) && !/^\d+(\.\d+)?$/.test(trimmed)) return { kind: "invalid" }
  if (trimmed.endsWith(".")) {
    const head = Number(trimmed.slice(0, -1))
    if (!Number.isFinite(head)) return { kind: "invalid" }
    return { kind: "pending", value: head }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { kind: "invalid" }
  return { kind: "value", value }
}

export function formatAreaMeasure(value: number | null): string {
  if (value === null) return ""
  return String(value)
}

export function formatAreaBothUnits(sqFt: number | null): string {
  if (sqFt === null) return "—"
  const sqMeter = sqFtToSqMeter(sqFt)
  if (sqMeter === undefined) return `${String(sqFt)} sq ft`
  return `${String(sqFt)} sq ft (${String(sqMeter)} sq m)`
}

/**
 * Plinth is the sum of countable ground-floor rows. Open-land rows are excluded.
 * No ground-floor row returns null so a stored plinth can be cleared.
 */
export function plinthSqFtFromFloors(floors: readonly AreaFloor[]): number | null {
  let sum = 0
  let count = 0
  for (const floor of floors) {
    if (floor.floorPosition !== GROUND_FLOOR) continue
    if (isExcludedFromPlotAreaCheck(floor.floorPosition, floor.usageFactor)) continue
    sum += floorAreaNumber(floor.areaSqFt)
    count += 1
  }
  if (count === 0) return null
  return Math.round(sum * 10000) / 10000
}

/**
 * Built-up matches `floors.repository` `sumBuiltUpArea` (open-land rows excluded;
 * open-land property use stores zero). Open land is that excluded sum — there is no column.
 */
export function summarizeAreas(propertyUse: string | null, floors: readonly AreaFloor[]): AreaSummary {
  const rows = floors.map((floor) => ({
    floorPosition: floor.floorPosition,
    usageFactor: floor.usageFactor,
    areaSqFt: floorAreaNumber(floor.areaSqFt),
  }))
  let openLandSqFt = 0
  let openLandFloorCount = 0
  let builtUpFloorCount = 0
  for (const floor of rows) {
    if (isExcludedFromPlotAreaCheck(floor.floorPosition, floor.usageFactor)) {
      openLandSqFt += floor.areaSqFt
      openLandFloorCount += 1
    } else {
      builtUpFloorCount += 1
    }
  }
  const builtUpSqFt = isOpenLandPropertyUse(propertyUse) ? 0 : sumBuiltUpArea(rows)
  return { builtUpSqFt, openLandSqFt, builtUpFloorCount, openLandFloorCount }
}

/** Square feet plus the shared square-meter conversion the floor repository already uses. */
export function areaMeasurePatch(
  kind: "plot" | "plinth",
  sqFt: number | null
): Pick<SurveyPatch, "plotAreaSqFt" | "plotAreaSqMeter" | "plinthAreaSqFt" | "plinthAreaSqMeter"> {
  return areaMeasurePatchFromPair(kind, areaPairFromSource("sqFt", sqFt))
}

export function areaMeasurePatchFromPair(
  kind: "plot" | "plinth",
  pair: AreaPair
): Pick<SurveyPatch, "plotAreaSqFt" | "plotAreaSqMeter" | "plinthAreaSqFt" | "plinthAreaSqMeter"> {
  if (kind === "plot") return { plotAreaSqFt: pair.sqFt, plotAreaSqMeter: pair.sqMeter }
  return { plinthAreaSqFt: pair.sqFt, plinthAreaSqMeter: pair.sqMeter }
}
