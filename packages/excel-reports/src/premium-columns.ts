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
import type { FloorExportRow, SurveyExportBundle } from "./types.js"
import type { ColumnKind } from "./workbook-shell.js"

export type PremiumColumn = {
  header: string
  kind: ColumnKind
  /** Soft-highlight when blank / N/A / empty. */
  mandatory?: boolean
  /** Preserve as Excel text (leading zeros). */
  forceText?: boolean
}

/** Floor positions in schema order (wide pivot). */
export const FLOOR_EXPORT_POSITIONS = [
  { code: "BASEMENT", label: "Basement" },
  { code: "GROUND_FLOOR", label: "Ground Floor" },
  { code: "FIRST_FLOOR", label: "First Floor" },
  { code: "SECOND_FLOOR", label: "Second Floor" },
  { code: "THIRD_FLOOR", label: "Third Floor" },
  { code: "FOURTH_FLOOR", label: "Fourth Floor" },
  { code: "FIFTH_FLOOR", label: "Fifth Floor" },
  { code: "SIXTH_FLOOR", label: "Sixth Floor" },
  { code: "OPEN_LAND", label: "Open Land" },
] as const

function na(value: string | null | undefined): string {
  return formatExportText(value)
}

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "N/A"
  return value ? "Yes" : "No"
}

function textId(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "N/A"
  return String(value)
}

/** Combined ward display: `{wardNumber} - {wardName}` (e.g. `1 - Ward 1 - Etah`). */
export function formatWardNumberAndName(
  wardNumber: string | null | undefined,
  wardName: string | null | undefined
): string {
  const num = wardNumber != null ? String(wardNumber).trim() : ""
  const name = wardName != null ? String(wardName).trim() : ""
  if (num && name) return `${num} - ${name}`
  if (name) return name
  if (num) return num
  return "N/A"
}

function floorByPosition(floors: FloorExportRow[], position: string): FloorExportRow | undefined {
  return floors.find(
    (f) =>
      f.floorPosition === position ||
      (position === "FIFTH_FLOOR" && (f.floorPosition === "FIFTH_FLOOR" || f.floorPosition === "FIFTH_FLOOR_PLUS"))
  )
}

function buildFloorPivotColumns(): PremiumColumn[] {
  const cols: PremiumColumn[] = []
  for (const floor of FLOOR_EXPORT_POSITIONS) {
    cols.push(
      { header: `${floor.label} Area`, kind: "number" },
      { header: `${floor.label} Usage Factor`, kind: "text" },
      { header: `${floor.label} Usage Type`, kind: "text" },
      { header: `${floor.label} Construction Type`, kind: "text" }
    )
  }
  return cols
}

function floorPivotValues(floors: FloorExportRow[]): unknown[] {
  const values: unknown[] = []
  for (const floor of FLOOR_EXPORT_POSITIONS) {
    const row = floorByPosition(floors, floor.code)
    if (!row) {
      values.push("", "N/A", "N/A", "N/A")
      continue
    }
    values.push(
      number(row.areaSqFt),
      display(row.usageFactor) || "N/A",
      display(row.usageType) || "N/A",
      display(row.constructionType) || "N/A"
    )
  }
  return values
}

export function resolvePremiumSurveyId(row: SurveyExportBundle): string {
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

/**
 * Shared Survey Data columns (Word baseline + schema). No tax.
 * Used by Survey Excel and as the QC Final prefix.
 */
export const COMMON_SURVEY_COLUMNS: PremiumColumn[] = [
  // 1–6: Survey / Workflow
  { header: "SN", kind: "number" },
  { header: "Status", kind: "text" },
  { header: "Surveyor Name", kind: "text" },
  { header: "Assessment Year", kind: "text" },
  { header: "Property Id", kind: "text", mandatory: true, forceText: true },
  { header: "Date of Survey", kind: "date" },
  // 7–17: Owner / Respondent
  { header: "Owner Name", kind: "text", mandatory: true },
  { header: "Owner Father Name", kind: "text" },
  { header: "Mobile No", kind: "text", forceText: true },
  { header: "Ward Name", kind: "text", mandatory: true, forceText: true },
  { header: "Is Slum", kind: "text" },
  { header: "Parcel No", kind: "text", mandatory: true, forceText: true },
  { header: "Unit No", kind: "text", forceText: true },
  { header: "old property Number", kind: "text", forceText: true },
  { header: "Constructed Date", kind: "date" },
  { header: "Respondent Name", kind: "text" },
  { header: "Respondent Relationship", kind: "text" },
  // 18–22: Address Information
  { header: "City", kind: "text" },
  { header: "Pincode", kind: "text", forceText: true },
  { header: "House No", kind: "text" },
  { header: "Locality", kind: "text" },
  { header: "Colony", kind: "text" },
  // 23–29: Property Classification
  { header: "Tax Rate Zone", kind: "text" },
  { header: "Property Ownership", kind: "text" },
  { header: "Property Type", kind: "text", mandatory: true },
  { header: "Property Uses", kind: "text", mandatory: true },
  { header: "Situation", kind: "text" },
  { header: "Road Type", kind: "text" },
  { header: "Floors", kind: "number" },
  // 30–32: Area Measurements
  { header: "Plot Area SqFt", kind: "number", mandatory: true },
  { header: "Plinth Area SqFt", kind: "number" },
  { header: "Total Built Up Area SqFt", kind: "number" },
  // 33–37: Utility Information
  { header: "Is Municipal Water Supply", kind: "text" },
  { header: "Total Water Connection", kind: "number" },
  { header: "Water Connection Id/Type", kind: "text" },
  { header: "Toilet Type", kind: "text" },
  { header: "Is Municipal Waste Service", kind: "text" },
  // 38–39: GPS / Location
  { header: "Latitude", kind: "number" },
  { header: "Longitude", kind: "number" },
]

/** @deprecated Use COMMON_SURVEY_COLUMNS */
export const SURVEY_PREMIUM_COLUMNS = COMMON_SURVEY_COLUMNS

export const QC_EXTRA_COLUMNS: PremiumColumn[] = [
  { header: "QC Status", kind: "text" },
  { header: "QC Approved By", kind: "text" },
  { header: "QC Approval Date", kind: "date" },
  { header: "QC Remarks", kind: "text" },
  { header: "Tax Zone", kind: "text" },
  { header: "Tax Rate", kind: "number" },
  { header: "Building Tax", kind: "money" },
  { header: "Water Tax", kind: "money" },
  { header: "Drainage Tax", kind: "money" },
  { header: "Penalty", kind: "money" },
  { header: "Current Demand", kind: "money" },
  { header: "Total Demand", kind: "money" },
]

/** @deprecated Use QC_EXTRA_COLUMNS */
export const QC_PREMIUM_EXTRA_COLUMNS = QC_EXTRA_COLUMNS

export const QC_FINAL_COLUMNS: PremiumColumn[] = [...COMMON_SURVEY_COLUMNS, ...QC_EXTRA_COLUMNS]

/** @deprecated Use QC_FINAL_COLUMNS */
export const QC_PREMIUM_COLUMNS = QC_FINAL_COLUMNS

export const SURVEY_ID_COLUMN_INDEX = 5 // 1-based: Property Id is column 5

export function toCommonSurveyRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  const owner = row.coOwners[0]
  const parcel = formatExportParcel(row.parcelNumber)
  const unit = formatExportUnitNumber(row.unitSubNo)
  const wardNo = row.ward?.wardNumber ?? row.wardNumber
  const wardName = row.ward?.wardName

  return [
    // 1–6: Survey / Workflow
    serialNumber,
    display(row.surveyStatus) || "N/A",
    na(row.createdBy?.fullName),
    display(row.assessmentYear) || "N/A",
    resolvePremiumSurveyId(row),
    row.submittedAt ?? row.capturedAt ?? "",
    // 7–17: Owner / Respondent
    na(owner?.name ?? row.respondentName),
    na(owner?.fatherOrHusbandName),
    formatExportMobile(owner?.mobile ?? row.mobileNumber),
    formatWardNumberAndName(wardNo, wardName),
    yesNo(row.isSlum),
    parcel || "N/A",
    unit,
    textId(row.propertyIdOld),
    row.constructedYear ?? "",
    na(row.respondentName),
    display(row.relationshipWithOwner) || "N/A",
    // 18–22: Address Information
    na(row.city ?? row.ulb?.name),
    textId(row.pinCode),
    na(row.houseDoorNo),
    na(row.locality),
    na(row.colony),
    // 23–29: Property Classification
    display(row.taxRateZone) || "N/A",
    display(row.ownershipType) || "N/A",
    display(row.propertyType) || "N/A",
    display(row.propertyUse) || "N/A",
    display(row.situation) || "N/A",
    display(row.roadType) || "N/A",
    computeFloorsAbbreviation(row.floors),
    // 30–32: Area Measurements
    number(row.plotAreaSqFt),
    number(row.plinthAreaSqFt),
    number(row.totalBuiltAreaSqFt),
    // 33–37: Utility Information
    display(row.waterConnection) || "N/A",
    "",
    display(row.sourceOfWater) || "N/A",
    display(row.sanitationType) || "N/A",
    yesNo(row.solidWasteCollection),
    // 38–39: GPS / Location
    number(row.latitude),
    number(row.longitude),
  ]
}

/** @deprecated Use toCommonSurveyRow */
export function toSurveyPremiumRow(row: SurveyExportBundle, serialNumber = 1): unknown[] {
  return toCommonSurveyRow(row, serialNumber)
}

export function toQcFinalRow(
  row: SurveyExportBundle,
  serialNumber: number,
  tax: ExportTaxSummary | null,
  taxRate: number | null = null
): unknown[] {
  const dash = "—"
  const moneyOrDash = (value: number | null | undefined): number | string =>
    value == null || Number.isNaN(value) ? dash : value

  const currentDemand = tax == null ? null : Number((tax.propertyTax + tax.waterTax + tax.drainageTax).toFixed(2))

  return [
    ...toCommonSurveyRow(row, serialNumber),
    display(row.qcStatus) || "N/A",
    na(row.qcApprovedByName),
    row.approvedAt ?? "",
    na(row.qcRemarks),
    display(row.taxRateZone) || dash,
    taxRate == null ? dash : taxRate,
    moneyOrDash(tax?.propertyTax),
    moneyOrDash(tax?.waterTax),
    moneyOrDash(tax?.drainageTax),
    moneyOrDash(tax?.penalty),
    moneyOrDash(currentDemand),
    moneyOrDash(tax?.totalDemand),
  ]
}

/** @deprecated Use toQcFinalRow */
export function toQcPremiumRow(
  row: SurveyExportBundle,
  tax: ExportTaxSummary | null,
  taxRate: number | null = null,
  serialNumber = 1
): unknown[] {
  return toQcFinalRow(row, serialNumber, tax, taxRate)
}

export function isMissingMandatoryValue(value: unknown): boolean {
  if (value == null) return true
  if (value === "") return true
  if (typeof value === "string" && (value.trim() === "" || value === "N/A" || value === "—")) return true
  return false
}
