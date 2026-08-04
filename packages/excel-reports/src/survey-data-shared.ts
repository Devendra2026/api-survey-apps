import { display, number, text } from "./convex-full.js"
import type { SurveyExportBundle } from "./types.js"

export const FIXED_HEADERS = [
  "SN",
  "Survey Id",
  "Owner Name",
  "Owner Father Name",
  "Mobile No",
  "Ward Name",
  "Parcel No",
  "Property No",
  "City",
  "Pincode",
  "House No",
  "Colony",
  "Tax Rate Zone",
  "Property Type",
  "Property Use",
  "Road Type",
] as const

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

  return [
    serialNumber,
    row.propertyId,
    text(owner?.name ?? row.respondentName),
    text(owner?.fatherOrHusbandName),
    text(owner?.mobile ?? row.mobileNumber),
    text(row.ward?.wardName ?? row.wardNumber),
    text(row.parcelNumber),
    row.propertyId,
    text(row.city ?? row.ulb?.name),
    text(row.pinCode),
    text(row.houseDoorNo),
    text(row.colony),
    display(row.taxRateZone),
    display(row.propertyType),
    display(row.propertyUse),
    display(row.roadType),
    row.floors.map((floor) => display(floor.floorPosition)).join(", "),
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
  return [
    sanitizeExportPathSegment(ulbCode),
    `${sanitizeExportPathSegment(wardNumber)}-${sanitizeExportPathSegment(wardName)}.xlsx`,
  ].join("/")
}
