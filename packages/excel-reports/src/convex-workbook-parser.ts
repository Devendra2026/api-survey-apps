/**
 * Shared Convex workbook parser for API + worker import paths.
 * Supports multi-sheet exports and Surveys-only workbooks with inline child columns.
 */
import { CONVEX_SHEETS, mergeChildSheetsWithInline, type WorkbookRow } from "@workspace/validation"
import ExcelJS from "exceljs"
import { Readable } from "node:stream"

export type { WorkbookRow }

export interface ParsedConvexWorkbook {
  surveys: WorkbookRow[]
  coOwners: WorkbookRow[]
  floors: WorkbookRow[]
  photos: WorkbookRow[]
  guide: WorkbookRow[]
  /** True when inline Surveys columns supplied children (dedicated sheets empty). */
  usedInlineColumns?: boolean
  /** True when both dedicated sheets and inline columns were present (sheets preferred). */
  sheetPreferredWarning?: boolean
}

export interface WorkbookDuplicateIssue {
  key: string
  rows: number[]
  kind: "propertyId" | "localId"
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "object") {
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") {
      return value.text
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text
    }
    if ("result" in value) {
      return cellValueToString(value.result)
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("")
    }
  }
  return ""
}

function sheetToRows(sheet: ExcelJS.Worksheet | undefined): WorkbookRow[] {
  if (!sheet) return []

  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, col) => {
    headers[col] = cellValueToString(cell.value).trim()
  })

  const rows: WorkbookRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: WorkbookRow = {}
    headers.forEach((header, col) => {
      if (!header) return
      record[header] = cellValueToString(row.getCell(col).value).trim()
    })
    if (Object.values(record).some((value) => value !== "")) {
      rows.push(record)
    }
  })
  return rows
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  return workbook.getWorksheet(name) ?? workbook.worksheets.find((sheet) => sheet.name.trim() === name)
}

async function loadWorkbook(source: Buffer | Readable, originalName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const lower = originalName.toLowerCase()
  const stream = Buffer.isBuffer(source) ? Readable.from(source) : source

  if (lower.endsWith(".csv")) {
    await workbook.csv.read(stream)
    return workbook
  }

  // Stream-based XLSX read avoids workbook.xlsx.load on a full ArrayBuffer allocation path.
  await workbook.xlsx.read(stream)
  return workbook
}

/**
 * Parses a Convex full-export workbook (Surveys / CoOwners / Floors / Photos / Guide).
 * Surveys sheet is required; other sheets are optional.
 * When child sheets are empty, expands inline Photos / Floors / CoOwners columns on Surveys.
 * Accepts Buffer or Readable so callers can stream object-storage downloads.
 */
export async function parseConvexWorkbook(
  source: Buffer | Readable,
  originalName: string
): Promise<ParsedConvexWorkbook> {
  const workbook = await loadWorkbook(source, originalName)
  const lower = originalName.toLowerCase()

  if (lower.endsWith(".csv")) {
    const surveys = sheetToRows(workbook.worksheets[0])
    if (!surveys.length) {
      throw new Error("Import file has no survey data rows")
    }
    const merged = mergeChildSheetsWithInline(surveys, { coOwners: [], floors: [], photos: [] })
    return {
      surveys,
      coOwners: merged.coOwners,
      floors: merged.floors,
      photos: merged.photos,
      guide: [],
      usedInlineColumns: merged.usedInlineColumns,
      sheetPreferredWarning: merged.sheetPreferredWarning,
    }
  }

  const surveysSheet = findSheet(workbook, CONVEX_SHEETS.surveys) ?? workbook.worksheets[0]
  if (!surveysSheet) {
    throw new Error(`Missing required sheet: ${CONVEX_SHEETS.surveys}`)
  }

  const surveys = sheetToRows(surveysSheet)
  if (!surveys.length) {
    throw new Error("Surveys sheet has no data rows")
  }

  const sheetChildren = {
    coOwners: sheetToRows(findSheet(workbook, CONVEX_SHEETS.coOwners)),
    floors: sheetToRows(findSheet(workbook, CONVEX_SHEETS.floors)),
    photos: sheetToRows(findSheet(workbook, CONVEX_SHEETS.photos)),
  }
  const merged = mergeChildSheetsWithInline(surveys, sheetChildren)

  return {
    surveys,
    coOwners: merged.coOwners,
    floors: merged.floors,
    photos: merged.photos,
    guide: sheetToRows(findSheet(workbook, CONVEX_SHEETS.guide)),
    usedInlineColumns: merged.usedInlineColumns,
    sheetPreferredWarning: merged.sheetPreferredWarning,
  }
}

export function groupRowsByPropertyId(rows: WorkbookRow[]): Map<string, WorkbookRow[]> {
  const map = new Map<string, WorkbookRow[]>()
  for (const row of rows) {
    const key = String(row["Property ID"] ?? "")
      .trim()
      .toUpperCase()
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}

/** Detect duplicate Property ID / Local ID values within the Surveys sheet. */
export function findWorkbookDuplicates(surveys: WorkbookRow[]): WorkbookDuplicateIssue[] {
  const byProperty = new Map<string, number[]>()
  const byLocal = new Map<string, number[]>()

  surveys.forEach((row, index) => {
    const excelRow = index + 2
    const propertyId = String(row["Property ID"] ?? "")
      .trim()
      .toUpperCase()
    const localId = String(row["Local ID"] ?? "")
      .trim()
      .toUpperCase()
    if (propertyId) {
      const list = byProperty.get(propertyId) ?? []
      list.push(excelRow)
      byProperty.set(propertyId, list)
    }
    if (localId) {
      const list = byLocal.get(localId) ?? []
      list.push(excelRow)
      byLocal.set(localId, list)
    }
  })

  const issues: WorkbookDuplicateIssue[] = []
  for (const [key, rows] of byProperty) {
    if (rows.length > 1) issues.push({ key, rows, kind: "propertyId" })
  }
  for (const [key, rows] of byLocal) {
    if (rows.length > 1) issues.push({ key, rows, kind: "localId" })
  }
  return issues
}
