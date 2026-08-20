import ExcelJS from "exceljs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isMissingMandatoryValue, type PremiumColumn } from "./premium-columns.js"
import type { ColumnKind } from "./workbook-shell.js"

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } }
const ALT_ROW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } }
const MISSING_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } }

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } }
const HEADER_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true }

export type EnterpriseWorkbookInput = {
  filename: string
  dataSheetName: string
  columns: readonly PremiumColumn[]
  /** 1-based column index to freeze alongside the header row (Survey ID). */
  freezeCol: number
  rows: AsyncIterable<unknown[]> | Iterable<unknown[]>
  onRow?: (values: unknown[]) => void
  exportedAt?: Date
  /** When true, apply AutoFilter on the header row. Default false. */
  enableAutoFilter?: boolean
}

/** @deprecated Use EnterpriseWorkbookInput */
export type PremiumWorkbookInput = EnterpriseWorkbookInput & {
  meta?: { exportedAt?: Date }
  stats?: unknown
  buildDashboard?: unknown
}

/** @deprecated Meta chrome removed from enterprise exports. */
export type PremiumReportMeta = {
  municipalityName?: string
  reportTitle?: string
  wardName?: string
  wardNumber?: string
  generatedBy?: string
  exportedAt?: Date
}

function normalizeCellValue(value: unknown, kind: ColumnKind, forceText?: boolean): unknown {
  if (forceText) {
    if (value == null || value === "") return ""
    return String(value)
  }
  if (kind === "date") {
    if (value instanceof Date) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? value : parsed
    }
    return ""
  }
  if (kind === "money" || kind === "number") {
    if (value === "" || value == null || value === "—" || value === "N/A")
      return value === "—" || value === "N/A" ? value : ""
    if (typeof value === "number") return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  return value ?? ""
}

function applyDataStyle(cell: ExcelJS.Cell, kind: ColumnKind, alt: boolean, forceText?: boolean): void {
  cell.border = THIN_BORDER
  if (alt) cell.fill = ALT_ROW_FILL
  if (forceText) {
    cell.numFmt = "@"
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
    return
  }
  switch (kind) {
    case "money":
      if (typeof cell.value === "number") cell.numFmt = "0.00"
      cell.alignment = { horizontal: "right", vertical: "middle" }
      break
    case "number":
      if (typeof cell.value === "number") cell.numFmt = "0.##"
      cell.alignment = { horizontal: "right", vertical: "middle" }
      break
    case "date":
      if (cell.value instanceof Date) cell.numFmt = "dd-mm-yyyy"
      cell.alignment = { horizontal: "left", vertical: "middle" }
      break
    default:
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
  }
}

/**
 * Single-sheet enterprise workbook: header row 1, data from row 2.
 * AutoFilter only when enableAutoFilter is true.
 */
export async function streamEnterpriseWorkbookToFile(input: EnterpriseWorkbookInput): Promise<{ rowCount: number }> {
  const columns = [...input.columns]
  const headers = columns.map((c) => c.header)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Municipal Property Tax Survey"
  workbook.created = input.exportedAt ?? new Date()

  const dataSheet = workbook.addWorksheet(input.dataSheetName, {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
    },
  })

  const headerRow = dataSheet.addRow(headers)
  headers.forEach((_header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = THIN_BORDER
  })
  headerRow.height = 32

  let rowCount = 0
  for await (const raw of input.rows) {
    rowCount += 1
    const values = columns.map((col, index) => normalizeCellValue(raw[index], col.kind, col.forceText))
    input.onRow?.(values)
    const excelRow = dataSheet.addRow(values)
    const alt = rowCount % 2 === 0
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = columns[colNumber - 1]!
      applyDataStyle(cell, col.kind, alt, col.forceText)
      if (col.mandatory && isMissingMandatoryValue(cell.value)) {
        cell.fill = MISSING_FILL
        cell.note = "Missing Required Data"
      }
    })
  }

  if (input.enableAutoFilter && headers.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    }
  }

  columns.forEach((col, index) => {
    const maxWidth = col.wide ? 80 : 36
    const minWidth = col.wide ? 48 : col.kind === "money" ? 12 : 10
    const width = Math.min(Math.max(col.header.length + 2, minWidth), maxWidth)
    dataSheet.getColumn(index + 1).width = width
  })

  // Re-apply after rows/columns are written — ExcelJS can drop views set at sheet creation.
  const scrollCol = excelCol(input.freezeCol + 1)
  dataSheet.views = [
    {
      state: "frozen",
      xSplit: input.freezeCol,
      ySplit: 1,
      topLeftCell: `${scrollCol}2`,
      activeCell: "A2",
    },
  ]

  await workbook.xlsx.writeFile(input.filename)
  return { rowCount }
}

/** @deprecated Prefer streamEnterpriseWorkbookToFile */
export async function streamPremiumWorkbookToFile(
  input: EnterpriseWorkbookInput | PremiumWorkbookInput
): Promise<{ rowCount: number }> {
  const exportedAt =
    "exportedAt" in input && input.exportedAt
      ? input.exportedAt
      : "meta" in input && input.meta?.exportedAt
        ? input.meta.exportedAt
        : undefined
  return streamEnterpriseWorkbookToFile({
    filename: input.filename,
    dataSheetName: input.dataSheetName,
    columns: input.columns,
    freezeCol: input.freezeCol,
    rows: input.rows,
    onRow: input.onRow,
    exportedAt,
    enableAutoFilter: input.enableAutoFilter,
  })
}

export async function renderEnterpriseWorkbook(input: Omit<EnterpriseWorkbookInput, "filename">): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "enterprise-xlsx-"))
  const filename = join(dir, "report.xlsx")
  try {
    await streamEnterpriseWorkbookToFile({ ...input, filename })
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** @deprecated Prefer renderEnterpriseWorkbook */
export async function renderPremiumWorkbook(
  input: Omit<EnterpriseWorkbookInput, "filename"> | Omit<PremiumWorkbookInput, "filename">
): Promise<Buffer> {
  const exportedAt =
    "exportedAt" in input && input.exportedAt
      ? input.exportedAt
      : "meta" in input && input.meta?.exportedAt
        ? input.meta.exportedAt
        : undefined
  return renderEnterpriseWorkbook({
    dataSheetName: input.dataSheetName,
    columns: input.columns,
    freezeCol: input.freezeCol,
    rows: input.rows,
    onRow: input.onRow,
    exportedAt,
    enableAutoFilter: input.enableAutoFilter,
  })
}

function excelCol(index1Based: number): string {
  let n = index1Based
  let s = ""
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
