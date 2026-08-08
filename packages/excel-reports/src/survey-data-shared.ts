import {
  computeFloorsAbbreviation,
  formatExportMobile,
  formatExportParcel,
  formatExportText,
  formatExportUnitNumber,
  resolveExportSurveyId,
  type ExportTaxSummary,
} from "@workspace/validation"
import { display, number } from "./convex-full.js"
import type { ColumnKind } from "./workbook-shell.js"
import type { SurveyExportBundle } from "./types.js"

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

const FLOOR_AREA_HEADERS: string[] = FLOOR_GROUPS.flatMap((group) => [
  `${group} Residential`,
  `${group} Non-Residential`,
])

/** Flat capture headers shared by Survey Data and QC Final prefix. */
export const SURVEY_CAPTURE_HEADERS = [
  "SN",
  "Survey Id",
  "Assessment Year",
  "Local ID",
  "Owner Name",
  "Owner Father Name",
  "Mobile No",
  "Alternate Mobile",
  "Ward Name",
  "Parcel No",
  "Unit Number",
  "House No",
  "Old Property Number (House Number)",
  "Colony",
  "Locality",
  "City",
  "Pincode",
  "Tax Rate Zone",
  "Property Type",
  "Property Use",
  "Road Type",
  "Ownership Type",
  "Situation",
  "Floors",
  ...FLOOR_AREA_HEADERS,
  "Plot Area SqFt",
  "Plinth Area SqFt",
  "Total Built Up Area SqFt",
  "Surveyor Name",
  "Survey Date",
  "Last Updated",
  "Latitude",
  "Longitude",
  "GPS Accuracy",
  "Survey Status",
] as const

export const SURVEY_CAPTURE_COLUMN_KINDS: ColumnKind[] = [
  "number", // SN
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text",
  "text", // Floors
  ...FLOOR_AREA_HEADERS.map((): ColumnKind => "number"),
  "number",
  "number",
  "number",
  "text",
  "date",
  "date",
  "number",
  "number",
  "number",
  "text",
]

export const QC_FINAL_EXTRA_HEADERS = [
  "QC Status",
  "QC Approved By",
  "QC Approval Date",
  "Remarks",
  "Property Tax",
  "Water Tax",
  "Drainage Tax",
  "Penalty",
  "Total Demand",
] as const

export const QC_FINAL_EXTRA_COLUMN_KINDS: ColumnKind[] = [
  "text",
  "text",
  "date",
  "text",
  "money",
  "money",
  "money",
  "money",
  "money",
]

export const QC_FINAL_HEADERS = [...SURVEY_CAPTURE_HEADERS, ...QC_FINAL_EXTRA_HEADERS] as const
export const QC_FINAL_COLUMN_KINDS = [...SURVEY_CAPTURE_COLUMN_KINDS, ...QC_FINAL_EXTRA_COLUMN_KINDS]

if (SURVEY_CAPTURE_HEADERS.length !== SURVEY_CAPTURE_COLUMN_KINDS.length) {
  throw new Error(
    `SURVEY_CAPTURE_HEADERS (${SURVEY_CAPTURE_HEADERS.length}) != COLUMN_KINDS (${SURVEY_CAPTURE_COLUMN_KINDS.length})`
  )
}
if (QC_FINAL_HEADERS.length !== QC_FINAL_COLUMN_KINDS.length) {
  throw new Error(`QC_FINAL_HEADERS (${QC_FINAL_HEADERS.length}) != COLUMN_KINDS (${QC_FINAL_COLUMN_KINDS.length})`)
}

/** @deprecated Use SURVEY_CAPTURE_HEADERS — kept for callers expecting FIXED_HEADERS length checks. */
export const FIXED_HEADERS = SURVEY_CAPTURE_HEADERS
export const FIXED_HEADER_COUNT = SURVEY_CAPTURE_HEADERS.length

function surveyDate(row: SurveyExportBundle): Date | "" {
  return row.submittedAt ?? row.capturedAt ?? ""
}

function buildFloorAreaCells(row: SurveyExportBundle): unknown[] {
  const floorCells = new Array<unknown>(20).fill("")
  for (const floor of row.floors) {
    const position = FLOOR_POSITIONS[floor.floorPosition]
    if (position == null) continue
    const isNonResidential = ["COMMERCIAL", "GODOWN", "MIXED"].includes(floor.usageFactor ?? "")
    floorCells[position * 2 + (isNonResidential ? 1 : 0)] = number(floor.areaSqFt)
  }
  return floorCells
}

export function resolveSurveyIdForExport(row: SurveyExportBundle): string {
  return (
    resolveExportSurveyId({
      propertyId: row.propertyId,
      ulbCode: row.ulb?.code,
      wardNo: row.ward?.wardNumber ?? row.wardNumber,
      parcelNo: row.parcelNumber,
      unitNo: row.unitSubNo,
      propertyUse: row.propertyUse,
    }) ?? "N/A"
  )
}

/** Shared capture row (Survey Data full sheet; QC Final prefix). */
export function toSurveyCaptureRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  const owner = row.coOwners[0]
  const surveyId = resolveSurveyIdForExport(row)

  return [
    serialNumber,
    surveyId,
    display(row.assessmentYear) || formatExportText(row.assessmentYear),
    formatExportText(row.localId),
    formatExportText(owner?.name ?? row.respondentName),
    formatExportText(owner?.fatherOrHusbandName),
    formatExportMobile(owner?.mobile ?? row.mobileNumber),
    formatExportText(owner?.alternateMobile ?? row.alternateMobile),
    formatExportText(row.ward?.wardName ?? row.wardNumber),
    formatExportParcel(row.parcelNumber),
    formatExportUnitNumber(row.unitSubNo),
    formatExportText(row.houseDoorNo),
    formatExportText(row.propertyIdOld),
    formatExportText(row.colony),
    formatExportText(row.locality),
    formatExportText(row.city ?? row.ulb?.name),
    formatExportText(row.pinCode),
    display(row.taxRateZone),
    display(row.propertyType),
    display(row.propertyUse),
    display(row.roadType),
    display(row.ownershipType),
    display(row.situation),
    computeFloorsAbbreviation(row.floors),
    ...buildFloorAreaCells(row),
    number(row.plotAreaSqFt),
    number(row.plinthAreaSqFt),
    number(row.totalBuiltAreaSqFt),
    formatExportText(row.createdBy?.fullName),
    surveyDate(row),
    row.clientUpdatedAt ?? row.createdAt,
    number(row.latitude),
    number(row.longitude),
    number(row.gpsAccuracyMeters),
    display(row.surveyStatus),
  ]
}

/** @deprecated Alias for toSurveyCaptureRow */
export function toSurveyBaseRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  return toSurveyCaptureRow(row, serialNumber)
}

export function toQcFinalRow(row: SurveyExportBundle, serialNumber: number, tax: ExportTaxSummary): unknown[] {
  return [
    ...toSurveyCaptureRow(row, serialNumber),
    display(row.qcStatus),
    formatExportText(row.qcApprovedByName),
    row.approvedAt ?? "",
    formatExportText(row.qcRemarks),
    tax.propertyTax,
    tax.waterTax,
    tax.drainageTax,
    tax.penalty,
    tax.totalDemand,
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
  ulbName?: string | null
}

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

/** Hard-fail validators used by exporters / worker. */
export function assertValidSurveyId(surveyId: string, context: string): void {
  if (!surveyId || surveyId === "N/A") {
    throw new Error(`${context}: blank Survey Id`)
  }
}

export function assertUniqueSurveyId(seen: Set<string>, surveyId: string, context: string): void {
  assertValidSurveyId(surveyId, context)
  if (seen.has(surveyId)) {
    throw new Error(`${context}: duplicate Survey Id ${surveyId}`)
  }
  seen.add(surveyId)
}

export function assertQcMandatoryFields(row: SurveyExportBundle, surveyId: string): void {
  const owner = formatExportText(row.coOwners[0]?.name ?? row.respondentName)
  const parcel = formatExportParcel(row.parcelNumber)
  if (!owner || owner === "N/A") {
    throw new Error(`qc_final: blank Owner Name for Survey Id ${surveyId}`)
  }
  if (!parcel) {
    throw new Error(`qc_final: blank Parcel Number for Survey Id ${surveyId}`)
  }
}
