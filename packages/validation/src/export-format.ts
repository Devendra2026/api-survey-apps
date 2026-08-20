/**
 * Shared formatting for Survey Data / QC Final Excel export rows.
 */

import { sqFtToSqMeter } from "./convex-import-map.js"
import { formatPropertyId, padParcelNo, padUnitNo } from "./property-id.js"

export const EXPORT_NA = "N/A"
export const EXPORT_MOBILE_FALLBACK = "0000000000"

/** Floor positions that contribute to Floors abbreviation (Open Land excluded). */
export const EXPORT_FLOOR_ABBREV_ORDER: ReadonlyArray<{ position: string; code: string }> = [
  { position: "BASEMENT", code: "B" },
  { position: "GROUND_FLOOR", code: "G" },
  { position: "FIRST_FLOOR", code: "F1" },
  { position: "SECOND_FLOOR", code: "F2" },
  { position: "THIRD_FLOOR", code: "F3" },
  { position: "FOURTH_FLOOR", code: "F4" },
  { position: "FIFTH_FLOOR", code: "F5" },
  { position: "FIFTH_FLOOR_PLUS", code: "F5" },
  { position: "SIXTH_FLOOR", code: "F6" },
  { position: "SEVENTH_FLOOR", code: "F7" },
]

export type ExportFloorAreaInput = {
  floorPosition: string
  areaSqFt?: number | { toString(): string } | null
}

export type ExportFloorDetailInput = ExportFloorAreaInput & {
  usageFactor?: string | null
  usageType?: string | null
  constructionType?: string | null
}

const FLOOR_POSITION_EXPORT_LABELS: Record<string, string> = {
  OPEN_LAND: "Open Land (Plot)",
  FIFTH_FLOOR_PLUS: "Fifth Floor",
}

const CONSTRUCTION_EXPORT_LABELS: Record<string, string> = {
  PAKKA_BUILDING_WITH_RCC_ROOF: "Pakka Building with R.C.C Roof or R.B. Roof",
  RCC: "Pakka Building with R.C.C Roof or R.B. Roof",
  TIN_SHED: "Tin Shed",
  OPEN_LAND: "Open Land (Plot) / Under Construction land",
  UNDER_CONSTRUCTION: "Open Land (Plot) / Under Construction land",
  KACCHA_BUILDING: "Kaccha Building",
}

const USAGE_TYPE_EXPORT_LABELS: Record<string, string> = {
  SELF_OCCUPIED: "Self Occupied",
  SELF: "Self Occupied",
  RENTED: "Rented",
}

function titleCaseFromEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatExportUsageFactorLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "N/A"
  const key = value.toUpperCase()
  if (key === "OPEN_LAND") return "Open Land"
  return titleCaseFromEnum(key)
}

function formatExportUsageTypeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "N/A"
  const key = value.toUpperCase()
  return USAGE_TYPE_EXPORT_LABELS[key] ?? titleCaseFromEnum(key)
}

function formatExportConstructionLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "N/A"
  const key = value.toUpperCase().replace(/\s+/g, "_")
  return CONSTRUCTION_EXPORT_LABELS[key] ?? titleCaseFromEnum(key)
}

function formatExportFloorPositionLabel(floorPosition: string): string {
  const key = floorPosition.toUpperCase()
  return FLOOR_POSITION_EXPORT_LABELS[key] ?? titleCaseFromEnum(key)
}

function formatExportAreaSqFt(area: number): string {
  return Number.isInteger(area) ? String(area) : String(area)
}

function formatExportAreaSqMt(sqFt: number): string {
  const sqMt = sqFtToSqMeter(sqFt)
  return sqMt == null ? "0.0000" : sqMt.toFixed(4)
}

function toFiniteArea(value: number | { toString(): string } | null | undefined): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Floors abbreviation from built-up presence per level.
 * Active codes concatenate in order (e.g. GF1, BGF1F2, GF4). None → P.
 * OPEN_LAND does not contribute a letter.
 */
export function computeFloorsAbbreviation(floors: ExportFloorAreaInput[]): string {
  const areaByPosition = new Map<string, number>()
  for (const floor of floors) {
    const area = toFiniteArea(floor.areaSqFt)
    if (area <= 0) continue
    const key = floor.floorPosition
    if (key === "OPEN_LAND") continue
    areaByPosition.set(key, (areaByPosition.get(key) ?? 0) + area)
  }

  const codes: string[] = []
  const seenCodes = new Set<string>()
  for (const { position, code } of EXPORT_FLOOR_ABBREV_ORDER) {
    if ((areaByPosition.get(position) ?? 0) <= 0) continue
    if (seenCodes.has(code)) continue
    seenCodes.add(code)
    codes.push(code)
  }

  return codes.length > 0 ? codes.join("") : "P"
}

/**
 * One floor row in legacy survey Excel narrative format:
 * `Ground Floor - 600 SqFt - 55.7418 SqMt || Usage Type - Residential || Usage Factor - Self Occupied || Usage Type - Pakka Building...`
 */
export function formatExportFloorDetailLine(floor: ExportFloorDetailInput): string {
  const area = toFiniteArea(floor.areaSqFt)
  const position = formatExportFloorPositionLabel(floor.floorPosition)
  return [
    `${position} - ${formatExportAreaSqFt(area)} SqFt - ${formatExportAreaSqMt(area)} SqMt`,
    `Usage Type - ${formatExportUsageFactorLabel(floor.usageFactor)}`,
    `Usage Factor - ${formatExportUsageTypeLabel(floor.usageType)}`,
    `Usage Type - ${formatExportConstructionLabel(floor.constructionType)}`,
  ].join(" || ")
}

/** Join all floor rows into the single Floors column narrative. */
export function formatExportFloorDetails(floors: ExportFloorDetailInput[]): string {
  if (!floors.length) return ""
  const lines = floors
    .filter((floor) => {
      const area = toFiniteArea(floor.areaSqFt)
      if (area > 0) return true
      return floor.floorPosition.toUpperCase() === "OPEN_LAND"
    })
    .map(formatExportFloorDetailLine)
  return lines.join(",\n")
}

/** Blank / non-10-digit / all-zeros → 0000000000. */
export function formatExportMobile(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "")
  if (digits.length !== 10) return EXPORT_MOBILE_FALLBACK
  if (/^0+$/.test(digits)) return EXPORT_MOBILE_FALLBACK
  return digits
}

export function formatExportText(value: string | null | undefined, fallback = EXPORT_NA): string {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export function formatExportParcel(parcelNumber: string | null | undefined): string {
  const padded = padParcelNo(parcelNumber ?? "")
  return padded || ""
}

export function formatExportUnitNumber(unitSubNo: string | null | undefined): string {
  const padded = padUnitNo(unitSubNo ?? "")
  return padded || EXPORT_NA
}

/**
 * Survey Id for export: stored propertyId, else derived Property ID formula, else null.
 */
export function resolveExportSurveyId(input: {
  propertyId?: string | null
  ulbCode?: string | null
  wardNo?: string | null
  parcelNo?: string | null
  unitNo?: string | null
  propertyUse?: string | null
}): string | null {
  const existing = (input.propertyId ?? "").trim()
  if (existing) return existing.toUpperCase()

  const ulbCode = (input.ulbCode ?? "").trim()
  const wardNo = (input.wardNo ?? "").trim()
  const parcelNo = (input.parcelNo ?? "").trim()
  const unitNo = (input.unitNo ?? "").trim()
  const propertyUse = (input.propertyUse ?? "").trim()
  if (!ulbCode || !wardNo || !parcelNo || !unitNo || !propertyUse) return null

  return formatPropertyId({ ulbCode, wardNo, parcelNo, unitNo, propertyUse }) ?? null
}
