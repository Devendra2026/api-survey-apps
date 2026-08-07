import {
  computeFloorsAbbreviation,
  formatExportMobile,
  formatExportParcel,
  formatExportText,
  formatExportUnitNumber,
  resolveExportSurveyId,
} from "@workspace/validation"
import { display, number } from "./convex-full.js"
import type { SurveyExportBundle } from "./types.js"

export const FIXED_HEADERS = [
  "SN",
  "Survey Id",
  "Owner Name",
  "Owner Father Name",
  "Mobile No",
  "Ward Name",
  "Parcel No",
  "Unit Number",
  "City",
  "Pincode",
  "House No",
  "Old Property Number (House Number)",
  "Colony",
  "Tax Rate Zone",
  "Property Type",
  "Property Use",
  "Road Type",
] as const

/** Column count of FIXED_HEADERS — used for Excel merge ranges. */
export const FIXED_HEADER_COUNT = FIXED_HEADERS.length

export const FLOOR_GROUPS = [
  "Basement",
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Fourth Floor",
  "Fifth Floor",
  "Sixth Floor",
  "Seventh Floor",
  "Open Land (Plot)",
] as const

export const FLOOR_POSITIONS: Record<string, number> = {
  BASEMENT: 0,
  GROUND_FLOOR: 1,
  FIRST_FLOOR: 2,
  SECOND_FLOOR: 3,
  THIRD_FLOOR: 4,
  FOURTH_FLOOR: 5,
  FIFTH_FLOOR: 6,
  FIFTH_FLOOR_PLUS: 6,
  SIXTH_FLOOR: 7,
  SEVENTH_FLOOR: 8,
  OPEN_LAND: 9,
}

/** Shared SN → floor matrix → plot/plinth/built cells (no tax columns). */
export function toSurveyBaseRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  const owner = row.coOwners[0]
  const floorCells = new Array<unknown>(20).fill("")
  for (const floor of row.floors) {
    const position = FLOOR_POSITIONS[floor.floorPosition]
    if (position == null) continue
    const isNonResidential = ["COMMERCIAL", "GODOWN", "MIXED"].includes(floor.usageFactor ?? "")
    floorCells[position * 2 + (isNonResidential ? 1 : 0)] = number(floor.areaSqFt)
  }

  const surveyId =
    resolveExportSurveyId({
      propertyId: row.propertyId,
      ulbCode: row.ulb?.code,
      wardNo: row.ward?.wardNumber ?? row.wardNumber,
      parcelNo: row.parcelNumber,
      unitNo: row.unitSubNo,
      propertyUse: row.propertyUse,
    }) ?? "N/A"

  return [
    serialNumber,
    surveyId,
    formatExportText(owner?.name ?? row.respondentName),
    formatExportText(owner?.fatherOrHusbandName),
    formatExportMobile(owner?.mobile ?? row.mobileNumber),
    formatExportText(row.ward?.wardName ?? row.wardNumber),
    formatExportParcel(row.parcelNumber),
    formatExportUnitNumber(row.unitSubNo),
    formatExportText(row.city ?? row.ulb?.name),
    formatExportText(row.pinCode),
    formatExportText(row.houseDoorNo),
    formatExportText(row.propertyIdOld),
    formatExportText(row.colony),
    display(row.taxRateZone),
    display(row.propertyType),
    display(row.propertyUse),
    display(row.roadType),
    computeFloorsAbbreviation(row.floors),
    ...floorCells,
    number(row.plotAreaSqFt),
    number(row.plinthAreaSqFt),
    number(row.totalBuiltAreaSqFt),
  ]
}

export function sanitizeExportPathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "unknown"
  )
}

export type BuildExportFilenameInput = {
  report: "qc_final" | "survey_data"
  wardName?: string | null
  districtName?: string | null
  /** Unused for Ward_District filenames; kept for callers that still pass ulb. */
  ulbName?: string | null
}

/** Filenames: QC_Final_Report_<Ward>_<District>.xlsx / Survey_<Ward>_<District>.xlsx */
export function buildExportFilename(input: BuildExportFilenameInput): string {
  const ward = sanitizeExportPathSegment(input.wardName ?? "Ward")
  const district = sanitizeExportPathSegment(input.districtName ?? "District")
  if (input.report === "qc_final") {
    return `QC_Final_Report_${ward}_${district}.xlsx`
  }
  return `Survey_${ward}_${district}.xlsx`
}

export function assertExportRowCount(written: number, expected: number, reportType: string): void {
  if (written !== expected) {
    throw new Error(
      `${reportType} export row count mismatch: wrote ${written.toLocaleString("en-IN")} of ${expected.toLocaleString("en-IN")} surveys`
    )
  }
}

export function wardSurveyDataZipEntry(ulbCode: string, wardNumber: string, wardName: string): string {
  const safeWard = sanitizeExportPathSegment(`${wardNumber}-${wardName}`)
  return `${sanitizeExportPathSegment(ulbCode)}/${safeWard}.xlsx`
}
