import ExcelJS from "exceljs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type ColumnKind = "text" | "number" | "money" | "date"

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9EAF7" },
}

export type StreamFlatWorkbookInput = {
  filename: string
  sheetName: string
  title?: string
  headers: readonly string[]
  columnKinds: readonly ColumnKind[]
  rows: AsyncIterable<unknown[]> | Iterable<unknown[]>
  /** Sample first N data rows to refine column widths (default 100). */
  widthSampleRows?: number
}

function columnWidthFor(header: string, kind: ColumnKind, samples: unknown[]): number {
  let maxLen = header.length
  for (const sample of samples) {
    if (sample == null || sample === "") continue
    const text = sample instanceof Date ? "00-00-0000" : typeof sample === "number" ? String(sample) : String(sample)
    maxLen = Math.max(maxLen, text.length)
  }
  const base = kind === "money" || kind === "number" ? Math.max(maxLen, 10) : maxLen
  return Math.min(Math.max(base + 2, 10), 40)
}

function applyHeaderStyle(row: ExcelJS.Row): void {
  row.font = { bold: true }
  row.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  row.fill = HEADER_FILL
  row.height = 28
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = THIN_BORDER
  })
}

function applyDataCellStyle(cell: ExcelJS.Cell, kind: ColumnKind): void {
  cell.border = THIN_BORDER
  switch (kind) {
    case "money":
      cell.numFmt = "0.00"
      cell.alignment = { horizontal: "right", vertical: "middle" }
      break
    case "number":
      cell.numFmt = "0.##"
      cell.alignment = { horizontal: "right", vertical: "middle" }
      break
    case "date":
      cell.numFmt = "dd-mm-yyyy"
      cell.alignment = { horizontal: "left", vertical: "middle" }
      break
    default:
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
  }
}

function normalizeCellValue(value: unknown, kind: ColumnKind): unknown {
  if (kind === "date") {
    if (value instanceof Date) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? value : parsed
    }
    return ""
  }
  if (kind === "money" || kind === "number") {
    if (value === "" || value == null) return ""
    if (typeof value === "number") return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  return value ?? ""
}

/** Stream a flat-header workbook (optional title + one header row + data). */
export async function streamFlatWorkbookToFile(input: StreamFlatWorkbookInput): Promise<{ rowCount: number }> {
  const headers = [...input.headers]
  const kinds = [...input.columnKinds]
  if (headers.length !== kinds.length) {
    throw new Error(`workbook-shell: headers (${headers.length}) and columnKinds (${kinds.length}) length mismatch`)
  }

  const hasTitle = Boolean(input.title?.trim())
  const headerRowIndex = hasTitle ? 2 : 1
  const sampleLimit = input.widthSampleRows ?? 100

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: input.filename,
    useStyles: true,
    useSharedStrings: false,
  })
  workbook.creator = "Municipal Property Tax Survey"

  const sheet = workbook.addWorksheet(input.sheetName, {
    views: [{ state: "frozen", ySplit: headerRowIndex }],
  })

  if (hasTitle) {
    const titleRow = sheet.addRow([input.title])
    titleRow.font = { bold: true, size: 14 }
    titleRow.alignment = { horizontal: "left", vertical: "middle" }
    sheet.mergeCells(1, 1, 1, headers.length)
    titleRow.commit()
  }

  const headerRow = sheet.addRow(headers)
  applyHeaderStyle(headerRow)
  headerRow.commit()

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: headers.length },
  }

  const samples: unknown[][] = headers.map(() => [])
  let rowCount = 0

  for await (const raw of input.rows) {
    rowCount += 1
    const values = headers.map((_, index) => normalizeCellValue(raw[index], kinds[index]!))
    const excelRow = sheet.addRow(values)
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const kind = kinds[colNumber - 1] ?? "text"
      applyDataCellStyle(cell, kind)
    })
    if (rowCount <= sampleLimit) {
      for (let i = 0; i < values.length; i += 1) {
        samples[i]!.push(values[i])
      }
    }
    if (rowCount === sampleLimit || rowCount === 1) {
      for (let i = 0; i < headers.length; i += 1) {
        sheet.getColumn(i + 1).width = columnWidthFor(headers[i]!, kinds[i]!, samples[i]!)
      }
    }
    excelRow.commit()
  }

  if (rowCount === 0) {
    for (let i = 0; i < headers.length; i += 1) {
      sheet.getColumn(i + 1).width = columnWidthFor(headers[i]!, kinds[i]!, [])
    }
  }

  await sheet.commit()
  await workbook.commit()
  return { rowCount }
}

/** Buffer helper for tests / small sync paths. */
export async function renderFlatWorkbook(input: Omit<StreamFlatWorkbookInput, "filename">): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "flat-xlsx-"))
  const filename = join(dir, "report.xlsx")
  try {
    await streamFlatWorkbookToFile({ ...input, filename })
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
