import type { SurveyRegistryRecord } from "@/lib/api/types"
import * as XLSX from "xlsx"

const EXPORT_HEADERS = [
  "S.No",
  "Status",
  "Surveyor Name",
  "Property ID",
  "Ward Number",
  "Parcel Number",
  "Owner Name",
  "Survey Date",
] as const

export function exportRegistryToExcel(rows: SurveyRegistryRecord[], filename = "Survey_Registry.xlsx") {
  const data = rows.map((row, index) => ({
    "S.No": index + 1,
    Status: row.status,
    "Surveyor Name": row.surveyorName,
    "Property ID": row.propertyId,
    "Ward Number": row.wardNumber,
    "Parcel Number": row.parcelNumber,
    "Owner Name": row.ownerName,
    "Survey Date": row.surveyDate,
  }))

  const worksheet = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Survey Registry")
  XLSX.writeFile(workbook, filename)
}

export async function parseRegistryExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
}
