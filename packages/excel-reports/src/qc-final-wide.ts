import ExcelJS from "exceljs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorkbook, toBuffer } from "./convex-full.js"
import { FIXED_HEADER_COUNT, FIXED_HEADERS, FLOOR_GROUPS, toSurveyBaseRow } from "./survey-data-shared.js"
import type { SurveyExportBundle } from "./types.js"

/**
 * QC Final wide sheet matching survey.xlsx layout (+ blank tax columns).
 * APPROVED-only filtering belongs in the query layer; tax values intentionally blank.
 */
export async function renderQcFinalWideWorkbook(rows: SurveyExportBundle[]): Promise<Buffer> {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet("Survey Data", { views: [{ state: "frozen", ySplit: 4 }] })
  addQcFinalWideHeaders(sheet)
  for (const [index, row] of rows.entries()) sheet.addRow(toQcFinalWideRow(row, index + 1))
  applyColumnWidths(sheet)
  return toBuffer(workbook)
}

export async function streamQcFinalWideWorkbookToFile(
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
  addQcFinalWideHeaders(sheet)
  for (let rowNumber = 1; rowNumber <= 4; rowNumber += 1) {
    sheet.getRow(rowNumber).commit()
  }
  applyColumnWidths(sheet)

  let rowCount = 0
  for await (const row of rows) {
    rowCount += 1
    sheet.addRow(toQcFinalWideRow(row, rowCount)).commit()
  }

  await sheet.commit()
  await workbook.commit()
  return { rowCount }
}

export async function renderQcFinalWideWorkbookStreaming(
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "qc-final-wide-"))
  const filename = join(dir, "qc-final.xlsx")
  try {
    await streamQcFinalWideWorkbookToFile(filename, rows)
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Base survey row + blank Total Demand / Total Tax Demand placeholders (21 + 3 cells). */
export function toQcFinalWideRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  return [...toSurveyBaseRow(row, serialNumber), ...new Array<unknown>(21).fill(""), "", "", ""]
}

function applyColumnWidths(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column, index) => {
    column.width = index < FIXED_HEADER_COUNT ? 18 : index === FIXED_HEADER_COUNT ? 20 : 14
  })
  sheet.getColumn(3).width = 24
  sheet.getColumn(4).width = 24
  sheet.getColumn(12).width = 28
  sheet.getColumn(FIXED_HEADER_COUNT + 1).width = 28
}

function addQcFinalWideHeaders(sheet: ExcelJS.Worksheet): void {
  const floorsCol = FIXED_HEADER_COUNT + 1
  const matrixStart = floorsCol + 1
  const matrixEnd = matrixStart + 19
  const plotCol = matrixEnd + 1
  const plinthCol = plotCol + 1
  const builtCol = plinthCol + 1
  const demandStart = builtCol + 1
  const demandEnd = demandStart + 20
  const taxStart = demandEnd + 1

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

  for (let column = 1; column <= FIXED_HEADER_COUNT; column += 1) sheet.mergeCells(1, column, 4, column)
  sheet.mergeCells(1, floorsCol, 1, matrixEnd)
  for (let column = matrixStart; column <= matrixEnd - 1; column += 2) {
    sheet.mergeCells(2, column, 2, column + 1)
  }
  for (let column = matrixStart; column <= matrixEnd - 2; column += 1) {
    sheet.mergeCells(3, column, 4, column)
  }
  sheet.mergeCells(3, matrixEnd - 1, 4, matrixEnd)
  for (const column of [plotCol, plinthCol, builtCol]) {
    sheet.mergeCells(1, column, 4, column)
  }

  sheet.mergeCells(1, demandStart, 2, demandEnd)
  sheet.mergeCells(3, demandStart, 3, demandStart + 8)
  sheet.mergeCells(3, demandStart + 9, 3, demandStart + 17)
  sheet.mergeCells(3, demandStart + 18, 3, demandEnd)
  sheet.mergeCells(1, taxStart, 2, taxStart + 2)
  for (let column = taxStart; column <= taxStart + 2; column += 1) {
    sheet.mergeCells(3, column, 4, column)
  }

  for (let rowNumber = 1; rowNumber <= 4; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    row.font = { bold: true }
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber === 1 ? "FF1F4E78" : "FFD9EAF7" } }
  }
}
