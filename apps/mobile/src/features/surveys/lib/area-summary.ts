import {
  isExcludedFromPlotAreaCheck,
  isOpenLandPropertyUse,
  sqFtToSqMeter,
  sumBuiltUpArea,
} from "@workspace/validation"
import type { DecimalWire, SurveyPatch } from "../types.ts"

export type AreaFloor = {
  floorPosition: string
  usageFactor: string | null
  areaSqFt: DecimalWire
}

export type AreaSummary = {
  builtUpSqFt: number
  openLandSqFt: number
  builtUpFloorCount: number
  openLandFloorCount: number
}

export function floorAreaNumber(value: DecimalWire): number {
  if (value === null) return 0
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
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
  const meters = sqFt === null ? null : (sqFtToSqMeter(sqFt) ?? null)
  if (kind === "plot") return { plotAreaSqFt: sqFt, plotAreaSqMeter: meters }
  return { plinthAreaSqFt: sqFt, plinthAreaSqMeter: meters }
}
