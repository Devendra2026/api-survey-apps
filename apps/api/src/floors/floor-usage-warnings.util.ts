import { evaluateMixedUseFloorWarnings, type FloorUsageWarning } from "@workspace/validation"

type DecimalLike = { toString(): string } | number | string | null | undefined

function toNumber(value: DecimalLike): number | null {
  if (value == null) return null
  const n = Number(value.toString())
  return Number.isNaN(n) ? null : n
}

export type SurveyRowForFloorWarnings = {
  propertyUse?: string | null
  propertyType?: string | null
  plotAreaSqFt?: DecimalLike
  plinthAreaSqFt?: DecimalLike
  totalBuiltAreaSqFt?: DecimalLike
  floors?: Array<{
    floorPosition: string
    usageFactor: string | null
    areaSqFt?: DecimalLike
  }>
}

export function warningsFromSurveyRow(survey: SurveyRowForFloorWarnings): FloorUsageWarning[] {
  return evaluateMixedUseFloorWarnings({
    propertyUse: survey.propertyUse,
    propertyType: survey.propertyType,
    plotAreaSqFt: toNumber(survey.plotAreaSqFt),
    plinthAreaSqFt: toNumber(survey.plinthAreaSqFt),
    totalBuiltAreaSqFt: toNumber(survey.totalBuiltAreaSqFt),
    floors: (survey.floors ?? []).map((floor) => ({
      floorPosition: floor.floorPosition,
      usageFactor: floor.usageFactor,
      areaSqFt: toNumber(floor.areaSqFt),
    })),
  })
}

export type { FloorUsageWarning }
