import ExcelJS from "exceljs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorkbook, display, number, text, toBuffer } from "./convex-full.js"
import type { SurveyExportBundle } from "./types.js"

const FIXED_HEADERS = [
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

const FLOOR_GROUPS = [
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

const FLOOR_POSITIONS: Record<string, number> = {
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

export async function renderSurveyDataWorkbook(rows: SurveyExportBundle[]): Promise<Buffer> {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet("Survey Data", { views: [{ state: "frozen", ySplit: 4 }] })
  addHeaders(sheet)
  for (const [index, row] of rows.entries()) sheet.addRow(toSurveyDataRow(row, index + 1))
  applyColumnWidths(sheet)
  return toBuffer(workbook)
}

/** Stream Survey Data rows to an .xlsx file (memory-efficient for large exports). */
export async function streamSurveyDataWorkbookToFile(
  filename: string,
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>
): Promise<{ rowCount: number }> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename,
    useStyles: true,
    useSharedStrings: false,
  })
  workbook.creator = "Municipal Property Tax Survey"
  const sheet = workbook.addWorksheet("Survey Data", { views: [{ state: "frozen", ySplit: 4 }] })
  addHeaders(sheet)
  for (let rowNumber = 1; rowNumber <= 4; rowNumber += 1) {
    sheet.getRow(rowNumber).commit()
  }
  applyColumnWidths(sheet)

  let rowCount = 0
  for await (const row of rows) {
    rowCount += 1
    sheet.addRow(toSurveyDataRow(row, rowCount)).commit()
  }

  await sheet.commit()
  await workbook.commit()
  return { rowCount }
}

/** Buffer wrapper used by tests / small sync paths; streams via a temp file. */
export async function renderSurveyDataWorkbookStreaming(
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "survey-data-"))
  const filename = join(dir, "survey-data.xlsx")
  try {
    await streamSurveyDataWorkbookToFile(filename, rows)
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function toSurveyDataRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
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
    ...new Array<unknown>(21).fill(""),
    "",
    "",
    "",
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

export function wardSurveyDataZipEntry(ulbCode: string, wardNumber: string, wardName: string): string {
  return [
    sanitizeExportPathSegment(ulbCode),
    `${sanitizeExportPathSegment(wardNumber)}-${sanitizeExportPathSegment(wardName)}.xlsx`,
  ].join("/")
}

function applyColumnWidths(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column, index) => {
    column.width = index < 16 ? 18 : index === 16 ? 20 : 14
  })
  sheet.getColumn(3).width = 24
  sheet.getColumn(4).width = 24
  sheet.getColumn(17).width = 28
}

function addHeaders(sheet: ExcelJS.Worksheet): void {
  const row1 = [
    ...FIXED_HEADERS,
    "Floors",
    ...new Array(20).fill(""),
    "Plot Area SqFt",
    "Plinth Area SqFt",
    "Total Built Up Area SqFt",
    "Total Demand",
    ...new Array(20).fill(""),
    "Total Tax Demand",
    "",
    "",
  ]
  const row2 = [
    ...FIXED_HEADERS,
    "",
    ...FLOOR_GROUPS.flatMap((group) => [group, ""]),
    "Plot Area SqFt",
    "Plinth Area SqFt",
    "Total Built Up Area SqFt",
    "Total Demand",
    ...new Array(20).fill(""),
    "Total Tax Demand",
    "",
    "",
  ]
  const row3 = [
    ...FIXED_HEADERS,
    "",
    ...FLOOR_GROUPS.flatMap((group) =>
      group === "Open Land (Plot)" ? ["Open Land", ""] : ["Residential", "Non-Residential"]
    ),
    "Plot Area SqFt",
    "Plinth Area SqFt",
    "Total Built Up Area SqFt",
    "Residential",
    ...new Array(8).fill(""),
    "Non-Residential",
    ...new Array(8).fill(""),
    "Open Land",
    ...new Array(2).fill(""),
    "Total Tax 10%",
    "Total Water Tax 7.5%",
    "Total Drainage Tax 2.5%",
  ]
  const row4 = [
    ...FIXED_HEADERS,
    "Floor",
    ...FLOOR_GROUPS.flatMap((group) =>
      group === "Open Land (Plot)" ? ["Open Land", "Open Land"] : ["Residential", "Non-Residential"]
    ),
    "Plot Area SqFt",
    "Plinth Area SqFt",
    "Total Built Up Area SqFt",
    ...[
      "RCC",
      "T.Rate",
      "Tax",
      "TEEN",
      "T.Rate",
      "Tax",
      "KATCHA",
      "T.Rate",
      "Tax",
      "RCC",
      "T.Rate",
      "Tax",
      "TEEN",
      "T.Rate",
      "Tax",
      "KATCHA",
      "T.Rate",
      "Tax",
      "Plot Area",
      "Plot T.Rete",
      "Plot Tax",
    ],
    "Total Tax 10%",
    "Total Water Tax 7.5%",
    "Total Drainage Tax 2.5%",
  ]
  sheet.addRow(row1)
  sheet.addRow(row2)
  sheet.addRow(row3)
  sheet.addRow(row4)

  for (let column = 1; column <= 16; column += 1) sheet.mergeCells(1, column, 4, column)
  sheet.mergeCells("Q1:AK1")
  for (let column = 18; column <= 36; column += 2) sheet.mergeCells(2, column, 2, column + 1)
  for (let column = 18; column <= 35; column += 1) sheet.mergeCells(3, column, 4, column)
  sheet.mergeCells("AJ3:AK4")
  for (const column of ["AL", "AM", "AN"]) sheet.mergeCells(`${column}1:${column}4`)
  sheet.mergeCells("AO1:BI2")
  sheet.mergeCells("AO3:AW3")
  sheet.mergeCells("AX3:BF3")
  sheet.mergeCells("BG3:BI3")
  sheet.mergeCells("BJ1:BL2")
  for (const column of ["BJ", "BK", "BL"]) sheet.mergeCells(`${column}3:${column}4`)

  for (let rowNumber = 1; rowNumber <= 4; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    row.font = { bold: true }
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber === 1 ? "FF1F4E78" : "FFD9EAF7" } }
  }
}
