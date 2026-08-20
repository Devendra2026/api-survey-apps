import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { COMMON_SURVEY_COLUMNS, SURVEY_ID_COLUMN_INDEX, toCommonSurveyRow } from "./premium-columns.js"
import { renderEnterpriseWorkbook, streamEnterpriseWorkbookToFile } from "./premium-workbook.js"
import type { SurveyExportBundle } from "./types.js"

export {
  assertExportRowCount,
  buildExportFilename,
  sanitizeExportPathSegment,
  wardSurveyDataZipEntry,
  type BuildExportFilenameInput,
} from "./survey-data-shared.js"

export type SurveyPremiumExportOptions = {
  exportedAt?: Date
  enableAutoFilter?: boolean
}

async function* mapSurveyRows(
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>,
  duplicateLog: string[]
): AsyncGenerator<unknown[]> {
  const seen = new Set<string>()
  let serial = 0
  for await (const row of rows) {
    serial += 1
    const values = toCommonSurveyRow(row, serial)
    const surveyId = String(values[SURVEY_ID_COLUMN_INDEX - 1] ?? "")
    if (surveyId && surveyId !== "N/A") {
      if (seen.has(surveyId)) duplicateLog.push(surveyId)
      else seen.add(surveyId)
    }
    yield values
  }
}

/** Survey Data Report — common survey fields only (no tax). */
export async function renderSurveyDataWorkbook(
  rows: SurveyExportBundle[],
  options?: SurveyPremiumExportOptions
): Promise<Buffer> {
  const duplicates: string[] = []
  return renderEnterpriseWorkbook({
    dataSheetName: "Survey Data",
    columns: COMMON_SURVEY_COLUMNS,
    freezeCol: SURVEY_ID_COLUMN_INDEX,
    exportedAt: options?.exportedAt,
    enableAutoFilter: options?.enableAutoFilter,
    rows: mapSurveyRows(rows, duplicates),
  })
}

export async function streamSurveyDataWorkbookToFile(
  filename: string,
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>,
  options?: SurveyPremiumExportOptions
): Promise<{ rowCount: number; duplicateSurveyIds: string[] }> {
  const duplicates: string[] = []
  const { rowCount } = await streamEnterpriseWorkbookToFile({
    filename,
    dataSheetName: "Survey Data",
    columns: COMMON_SURVEY_COLUMNS,
    freezeCol: SURVEY_ID_COLUMN_INDEX,
    exportedAt: options?.exportedAt,
    enableAutoFilter: options?.enableAutoFilter,
    rows: mapSurveyRows(rows, duplicates),
  })
  return { rowCount, duplicateSurveyIds: duplicates }
}

export async function renderSurveyDataWorkbookStreaming(
  rows: AsyncIterable<SurveyExportBundle> | Iterable<SurveyExportBundle>,
  options?: SurveyPremiumExportOptions
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "survey-data-"))
  const filename = join(dir, "survey-data.xlsx")
  try {
    await streamSurveyDataWorkbookToFile(filename, rows, options)
    return await readFile(filename)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function toSurveyDataRow(row: SurveyExportBundle, serialNumber = 1): unknown[] {
  return toCommonSurveyRow(row, serialNumber)
}
