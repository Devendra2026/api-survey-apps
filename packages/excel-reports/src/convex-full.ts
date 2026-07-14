import { CONVEX_SHEETS, SURVEY_EXPORT_COLUMNS } from "@workspace/validation"
import ExcelJS from "exceljs"
import type { Numeric, SurveyExportBundle } from "./types.js"

const CO_OWNER_COLUMNS = ["Property ID", "Survey ID", "Owner Index", "Name", "Father / Husband Name", "Mobile", "Alt Mobile"]
const FLOOR_COLUMNS = [
  "Property ID",
  "Survey ID",
  "Client Floor ID",
  "Position",
  "Floor",
  "Usage Factor",
  "Usage Type",
  "Construction Type",
  "Occupancy",
  "Area (Sqft)",
]
const PHOTO_COLUMNS = ["Property ID", "Survey ID", "Slot", "Slot Key", "Captured At", "Size (KB)", "Width", "Height", "Photo URL"]

const GUIDE_ROWS = [
  ["Topic", "Detail"],
  ["Export", "All mobile survey fields, co-owners, floors, and photo metadata."],
  ["Import", "Edit the Surveys sheet; use CoOwners and Floors for related rows. Re-import via Surveys page."],
  ["Property ID", "Format: ULB(6)-Ward(3)-Parcel(5)-Unit(3)-UseLetter e.g. 801262-001-00004-001-R"],
  ["Match key", "Imports match existing surveys by Property ID, then Local ID."],
  ["Municipality ID", "Required Convex ID on each survey row — do not change unless moving ULB."],
]

export async function renderConvexFullWorkbook(rows: SurveyExportBundle[]): Promise<Buffer> {
  const workbook = createWorkbook()
  addTable(workbook, CONVEX_SHEETS.surveys, [...SURVEY_EXPORT_COLUMNS], rows.map(toSurveyRow))
  addTable(workbook, CONVEX_SHEETS.coOwners, CO_OWNER_COLUMNS, rows.flatMap(toCoOwnerRows))
  addTable(workbook, CONVEX_SHEETS.floors, FLOOR_COLUMNS, rows.flatMap(toFloorRows))
  addTable(workbook, CONVEX_SHEETS.photos, PHOTO_COLUMNS, rows.flatMap(toPhotoRows))
  addTable(workbook, CONVEX_SHEETS.guide, GUIDE_ROWS[0] as string[], GUIDE_ROWS.slice(1))
  return toBuffer(workbook)
}

export function toSurveyRow(row: SurveyExportBundle): unknown[] {
  return [
    row.id,
    text(row.localId),
    row.propertyId,
    "",
    text(row.district?.name),
    row.ulb?.code ?? "",
    text(row.ulb?.name ?? row.city),
    text(row.ulb?.code),
    text(row.ward?.wardNumber ?? row.wardNumber),
    text(row.sectorNo),
    text(row.parcelNumber),
    text(row.unitSubNo),
    text(row.propertyIdOld),
    row.constructedYear ?? "",
    yesNo(row.isSlum),
    text(row.respondentName),
    text(row.relationshipWithOwner),
    row.familySize ?? "",
    text(row.mobileNumber),
    text(row.alternateMobile),
    text(row.houseDoorNo),
    text(row.locality),
    text(row.colony),
    text(row.city),
    text(row.pinCode),
    display(row.assessmentYear),
    display(row.ownershipType),
    display(row.propertyUse),
    display(row.propertyType),
    display(row.situation),
    display(row.roadType),
    display(row.taxRateZone),
    number(row.plotAreaSqFt),
    number(row.plotAreaSqMeter),
    number(row.plinthAreaSqFt),
    number(row.plinthAreaSqMeter),
    number(row.totalBuiltAreaSqFt),
    number(row.totalBuiltAreaSqMeter),
    display(row.waterConnection),
    display(row.sourceOfWater),
    display(row.sanitationType),
    yesNo(row.solidWasteCollection),
    text(row.electricityConsumerNo),
    number(row.latitude),
    number(row.longitude),
    number(row.gpsAccuracyMeters),
    date(row.capturedAt),
    text(row.gpsProvider),
    yesNo(row.gpsMockLocation),
    display(row.surveyStatus),
    display(row.qcStatus),
    text(row.createdBy?.fullName),
    text(row.createdBy?.email),
    row.serverVersion ?? "",
    date(row.clientUpdatedAt),
    date(row.submittedAt),
    date(row.createdAt),
  ]
}

export function toCoOwnerRows(row: SurveyExportBundle): unknown[][] {
  return row.coOwners.map((owner, index) => [
    row.propertyId,
    row.id,
    owner.ownerIndex ?? index + 1,
    owner.name,
    text(owner.fatherOrHusbandName),
    text(owner.mobile),
    text(owner.alternateMobile),
  ])
}

export function toFloorRows(row: SurveyExportBundle): unknown[][] {
  return row.floors.map((floor, index) => [
    row.propertyId,
    row.id,
    text(floor.clientFloorId),
    floor.position ?? index,
    display(floor.floorPosition),
    display(floor.usageFactor),
    display(floor.usageType),
    display(floor.constructionType),
    text(floor.occupancy),
    number(floor.areaSqFt),
  ])
}

export function toPhotoRows(row: SurveyExportBundle): unknown[][] {
  return row.photos.map((photo) => [
    row.propertyId,
    row.id,
    display(photo.photoType),
    photo.photoType,
    date(photo.capturedAt),
    photo.sizeKB ?? "",
    photo.width ?? "",
    photo.height ?? "",
    photo.url,
  ])
}

export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Municipal Property Tax Survey"
  workbook.created = new Date()
  return workbook
}

export function addTable(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][]): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] })
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(row)
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(Math.max(headers[index]?.length ?? 12, 14), 32)
  })
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } }
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  header.height = 30
  return sheet
}

export async function toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function number(value: Numeric | null | undefined): number | "" {
  if (value == null) return ""
  const parsed = typeof value === "number" ? value : Number(value.toString())
  return Number.isFinite(parsed) ? parsed : ""
}

export function text(value: string | null | undefined): string {
  return value ?? ""
}

export function yesNo(value: boolean | null | undefined): string {
  return value == null ? "" : value ? "Yes" : "No"
}

export function date(value: Date | null | undefined): string {
  return value ? value.toISOString() : ""
}

export function display(value: string | null | undefined): string {
  if (!value) return ""
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
