import { computeExportTaxSummary, type ExportTaxRateTable, type ExportTaxSummary } from "@workspace/validation"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { QC_FINAL_COLUMNS, SURVEY_ID_COLUMN_INDEX, toCommonSurveyRow, toQcFinalRow } from "./premium-columns.js"
import { renderEnterpriseWorkbook, streamEnterpriseWorkbookToFile } from "./premium-workbook.js"
import type { SurveyExportBundle } from "./types.js"

export type QcFinalRowSource = SurveyExportBundle & {
  taxSummary?: ExportTaxSummary | null
  taxRate?: number | null
}

export type QcPremiumExportOptions = {
  rates?: ExportTaxRateTable
  exportedAt?: Date
  enableAutoFilter?: boolean
}

function resolveTaxSoft(
  row: QcFinalRowSource,
  rates?: ExportTaxRateTable
): {
  tax: ExportTaxSummary | null
  taxRate: number | null
} {
  if (row.taxSummary) {
    return { tax: row.taxSummary, taxRate: row.taxRate ?? null }
  }
  if (!rates) return { tax: null, taxRate: null }
  try {
    const tax = computeExportTaxSummary({
      taxRateZone: row.taxRateZone,
      propertyUse: row.propertyUse,
      waterConnection: row.waterConnection,
      totalBuiltAreaSqFt: row.totalBuiltAreaSqFt,
      plinthAreaSqFt: row.plinthAreaSqFt,
      floors: row.floors,
      rates,
    })
    const zone = (row.taxRateZone ?? "").trim()
    const taxRate = zone ? (rates.anyRateByZone.get(zone) ?? null) : null
    return { tax, taxRate }
  } catch {
    return { tax: null, taxRate: null }
  }
}

async function* mapQcRows(
  rows: AsyncIterable<QcFinalRowSource> | Iterable<QcFinalRowSource>,
  rates: ExportTaxRateTable | undefined,
  duplicateLog: string[]
): AsyncGenerator<unknown[]> {
  const seen = new Set<string>()
  let serial = 0
  for await (const row of rows) {
    serial += 1
    const { tax, taxRate } = resolveTaxSoft(row, rates)
    const values = toQcFinalRow(row, serial, tax, taxRate)
    const surveyId = String(values[1] ?? "")
    if (surveyId && surveyId !== "N/A") {
      if (seen.has(surveyId)) duplicateLog.push(surveyId)
      else seen.add(surveyId)
    }
    yield values
  }
}

function isRateTable(value: ExportTaxRateTable | QcPremiumExportOptions): value is ExportTaxRateTable {
  return "rateByZoneAndConstruction" in value
}

function normalizeOptions(ratesOrOptions?: ExportTaxRateTable | QcPremiumExportOptions): QcPremiumExportOptions {
  if (!ratesOrOptions) return {}
  if (isRateTable(ratesOrOptions)) return { rates: ratesOrOptions }
  return ratesOrOptions
}

/** QC Final Report — common survey + QC + ExportTaxSummary tax/demand. */
export async function renderQcFinalWideWorkbook(
  rows: QcFinalRowSource[],
  ratesOrOptions?: ExportTaxRateTable | QcPremiumExportOptions
): Promise<Buffer> {
  const options = normalizeOptions(ratesOrOptions)
  const duplicates: string[] = []
  return renderEnterpriseWorkbook({
    dataSheetName: "QC Final Report",
    columns: QC_FINAL_COLUMNS,
    freezeCol: SURVEY_ID_COLUMN_INDEX,
    exportedAt: options.exportedAt,
    enableAutoFilter: options.enableAutoFilter,
    rows: mapQcRows(rows, options.rates, duplicates),
  })
}

export async function streamQcFinalWideWorkbookToFile(
  filename: string,
  rows: AsyncIterable<QcFinalRowSource> | Iterable<QcFinalRowSource>,
  ratesOrOptions?: ExportTaxRateTable | QcPremiumExportOptions
): Promise<{ rowCount: number; duplicateSurveyIds: string[] }> {
  const options = normalizeOptions(ratesOrOptions)
  const duplicates: string[] = []
  const { rowCount } = await streamEnterpriseWorkbookToFile({
    filename,
    dataSheetName: "QC Final Report",
    columns: QC_FINAL_COLUMNS,
    freezeCol: SURVEY_ID_COLUMN_INDEX,
    exportedAt: options.exportedAt,
    enableAutoFilter: options.enableAutoFilter,
    rows: mapQcRows(rows, options.rates, duplicates),
  })
  return { rowCount, duplicateSurveyIds: duplicates }
}

export async function renderQcFinalWideWorkbookStreaming(
  rows: AsyncIterable<QcFinalRowSource> | Iterable<QcFinalRowSource>,
  ratesOrOptions?: ExportTaxRateTable | QcPremiumExportOptions
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "qc-final-wide-"))
  const filename = join(dir, "qc-final.xlsx")
  try {
    await streamQcFinalWideWorkbookToFile(filename, rows, ratesOrOptions)
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function toQcFinalWideRow(row: QcFinalRowSource, serialNumber = 1, tax?: ExportTaxSummary): unknown[] {
  return toQcFinalRow(row, serialNumber, tax ?? row.taxSummary ?? null, row.taxRate ?? null)
}

export function toSurveyDataRowFromQc(row: SurveyExportBundle, serialNumber = 1): unknown[] {
  return toCommonSurveyRow(row, serialNumber)
}
