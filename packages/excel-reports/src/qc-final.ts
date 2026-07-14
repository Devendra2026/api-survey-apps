import ExcelJS from "exceljs"
import { createWorkbook, date, display, number, text, toBuffer } from "./convex-full.js"
import type { SurveyExportBundle } from "./types.js"

export const QC_FINAL_REPORT_SHEET = "QC Final Report"

export const QC_FINAL_HEADERS = [
  "Property ID",
  "Owner",
  "Ward",
  "Parcel",
  "Unit",
  "District",
  "Municipality",
  "Locality",
  "Assessable sqft",
  "Plot sqft",
  "Plinth sqft",
  "Property Tax",
  "Water Tax",
  "Drainage Tax",
  "Total Annual Demand",
  "Survey Status",
  "QC Status",
  "Submitted At",
  "Surveyor",
] as const

export async function renderQcFinalWorkbook(rows: SurveyExportBundle[]): Promise<Buffer> {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet(QC_FINAL_REPORT_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.addRow([...QC_FINAL_HEADERS])

  const approved = rows.filter((row) => row.qcStatus === "APPROVED" || row.qcStatus === "approved")
  for (const row of approved) {
    sheet.addRow(toQcFinalRow(row))
  }

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true }
  sheet.getRow(1).height = 28
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(Math.max(QC_FINAL_HEADERS[index]?.length ?? 12, 12), 28)
  })
  return toBuffer(workbook)
}

export function toQcFinalRow(row: SurveyExportBundle): unknown[] {
  const owner = row.coOwners[0]
  const assessable =
    number(row.totalBuiltAreaSqFt) || row.floors.reduce((sum, floor) => sum + (Number(number(floor.areaSqFt)) || 0), 0)

  return [
    row.propertyId,
    text(owner?.name ?? row.respondentName),
    text(row.ward?.wardName ?? row.wardNumber),
    text(row.parcelNumber),
    text(row.unitSubNo),
    text(row.district?.name),
    text(row.ulb?.name ?? row.city),
    text(row.locality),
    assessable,
    number(row.plotAreaSqFt),
    number(row.plinthAreaSqFt),
    "",
    "",
    "",
    "",
    display(row.surveyStatus),
    display(row.qcStatus),
    date(row.submittedAt ?? row.createdAt),
    text(row.createdBy?.fullName ?? row.assignedTo?.fullName),
  ]
}

export function isQcFinalSheet(sheet: ExcelJS.Worksheet): boolean {
  return sheet.name === QC_FINAL_REPORT_SHEET && sheet.getRow(1).getCell(1).value === "Property ID"
}
