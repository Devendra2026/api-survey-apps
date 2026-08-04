import { describe, expect, it } from "@jest/globals"
import {
  assertExportRowCount,
  buildExportFilename,
  renderConvexFullWorkbook,
  renderNagarPanchayatWorkbook,
  renderQcFinalWideWorkbook,
  renderSurveyDataWorkbook,
  renderSurveyDataWorkbookStreaming,
  sanitizeExportPathSegment,
  type SurveyExportBundle,
  wardSurveyDataZipEntry,
} from "@workspace/excel-reports"
import ExcelJS from "exceljs"

const bundle: SurveyExportBundle = {
  id: "survey-1",
  propertyId: "801262-001-00004-001-R",
  wardNumber: "001",
  respondentName: "Asha Devi",
  mobileNumber: "9876543210",
  assessmentYear: "AY_2025_2026",
  surveyStatus: "APPROVED",
  qcStatus: "APPROVED",
  createdAt: new Date("2026-07-14T00:00:00.000Z"),
  createdBy: { fullName: "Surveyor One", email: "surveyor@example.test" },
  ward: { wardName: "Ward 1", wardNumber: "001" },
  ulb: { name: "Bakewar", code: "801262" },
  district: { name: "Etawah" },
  coOwners: [{ ownerIndex: 1, name: "Asha Devi", fatherOrHusbandName: "Ram Kumar" }],
  floors: [{ position: 0, floorPosition: "GROUND_FLOOR", areaSqFt: 1000, usageType: "SELF_OCCUPIED" }],
  photos: [{ photoType: "FRONT", url: "https://example.test/front.jpg", sizeKB: 42 }],
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text
  }
  return ""
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  const values = sheet.getRow(rowNumber).values
  if (!Array.isArray(values)) return []
  return values.slice(1).map((value) => cellText(value))
}

async function loadFromBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  // ExcelJS typings expect Buffer; Node 24 Buffer generics disagree with @types/node.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  return workbook
}

async function loadGolden(path: string): Promise<ExcelJS.Workbook | null> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path)
    return workbook
  } catch {
    return null
  }
}

describe("Excel report templates", () => {
  it("renders the exact Convex multi-sheet contract", async () => {
    const workbook = await loadFromBuffer(await renderConvexFullWorkbook([bundle]))

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Surveys", "CoOwners", "Floors", "Photos", "Guide"])
    expect(workbook.getWorksheet("Surveys")?.getRow(1).values).toContain("Survey ID")
    expect(workbook.getWorksheet("Surveys")?.getRow(2).values).toContain(bundle.propertyId)
    expect(workbook.getWorksheet("CoOwners")?.getRow(2).values).toContain("Asha Devi")
  })

  it("matches golden Convex full export sheet names and headers when available", async () => {
    const golden = await loadGolden("C:/sdv-books/docs/surveys_full_2026-07-10.xlsx")
    if (!golden) return

    const generated = await loadFromBuffer(await renderConvexFullWorkbook([bundle]))

    expect(generated.worksheets.map((sheet) => sheet.name)).toEqual(golden.worksheets.map((sheet) => sheet.name))
    for (const name of ["Surveys", "CoOwners", "Floors", "Photos"] as const) {
      expect(rowValues(generated.getWorksheet(name)!, 1)).toEqual(rowValues(golden.getWorksheet(name)!, 1))
    }
  })

  it("renders Bakewar's Survey Data header order", async () => {
    const workbook = await loadFromBuffer(await renderNagarPanchayatWorkbook([bundle]))

    const sheet = workbook.getWorksheet("Survey Data")
    expect(sheet?.getRow(1).values).toEqual(
      expect.arrayContaining(["SN", "Actions", "Status", "Surveyor Name", "Assessment Year", "Survey Id", "Floors"])
    )
    expect(sheet?.columnCount).toBe(45)
  })

  it("matches golden Nagar Panchayat headers when available", async () => {
    const golden = await loadGolden("E:/Sales/sdv-edutech/sdv-docs/Nagar-Panchayat-Bakewar-survey-data.xlsx")
    if (!golden) return

    const generated = await loadFromBuffer(await renderNagarPanchayatWorkbook([bundle]))
    const goldenSheet = golden.worksheets[0]
    const generatedSheet = generated.getWorksheet("Survey Data")
    expect(goldenSheet).toBeDefined()
    expect(generatedSheet).toBeDefined()
    if (!goldenSheet || !generatedSheet) return
    expect(rowValues(generatedSheet, 1)).toEqual(rowValues(goldenSheet, 1))
    expect(rowValues(generatedSheet, 1)).toHaveLength(45)
  })

  it("renders Survey Data verification sheet without tax demand columns", async () => {
    const workbook = await loadFromBuffer(
      await renderSurveyDataWorkbook([
        { ...bundle, qcStatus: "APPROVED" },
        { ...bundle, id: "survey-2", propertyId: "p-2", qcStatus: "PENDING" },
        { ...bundle, id: "survey-3", propertyId: "p-3", qcStatus: "REJECTED" },
      ])
    )

    const sheet = workbook.getWorksheet("Survey Data")!
    expect(sheet.getCell("Q1").value).toBe("Floors")
    expect(sheet.getCell("AL1").value).toBe("Plot Area SqFt")
    expect(sheet.getCell("AN1").value).toBe("Total Built Up Area SqFt")
    expect(sheet.getCell("AO1").value).toBeNull()

    const headerRow = rowValues(sheet, 1).join("|")
    expect(headerRow).not.toContain("Total Demand")
    expect(headerRow).not.toContain("Total Tax Demand")
    expect(headerRow).not.toContain("Total Tax 10%")
    // All QC statuses included (header + 3 data rows)
    expect(sheet.rowCount).toBe(7)
  })

  it("renders QC Final wide sheet with blank tax placeholders", async () => {
    const workbook = await loadFromBuffer(await renderQcFinalWideWorkbook([bundle]))

    const sheet = workbook.getWorksheet("Survey Data")!
    expect(sheet.getCell("Q1").value).toBe("Floors")
    expect(sheet.getCell("AO1").value).toBe("Total Demand")
    expect(sheet.getCell("BJ1").value).toBe("Total Tax Demand")
    expect(sheet.getCell("BL3").value).toBe("Total Drainage Tax 2.5%")
    expect(sheet.getCell("AO5").value).toBe("")
    expect(sheet.getCell("BJ5").value).toBe("")
  })

  it("streaming Survey Data matches buffer renderer key header cells", async () => {
    const streamed = await loadFromBuffer(await renderSurveyDataWorkbookStreaming([bundle]))
    const buffered = await loadFromBuffer(await renderSurveyDataWorkbook([bundle]))

    const streamedSheet = streamed.getWorksheet("Survey Data")!
    const bufferedSheet = buffered.getWorksheet("Survey Data")!
    expect(cellText(streamedSheet.getCell("Q1").value)).toBe(cellText(bufferedSheet.getCell("Q1").value))
    expect(cellText(streamedSheet.getCell("AL1").value)).toBe(cellText(bufferedSheet.getCell("AL1").value))
    expect(cellText(streamedSheet.getCell("AN1").value)).toBe(cellText(bufferedSheet.getCell("AN1").value))
    expect(cellText(streamedSheet.getCell("B5").value)).toBe(bundle.propertyId)
    expect(cellText(streamedSheet.getCell("C5").value)).toBe("Asha Devi")
  })

  it("maps legacy FIFTH_FLOOR_PLUS into Survey Data floor columns", async () => {
    const legacy = {
      ...bundle,
      floors: [{ position: 0, floorPosition: "FIFTH_FLOOR_PLUS", areaSqFt: 500, usageFactor: "RESIDENTIAL" }],
    }
    const workbook = await loadFromBuffer(await renderSurveyDataWorkbook([legacy]))
    const sheet = workbook.getWorksheet("Survey Data")!
    expect(sheet.getCell("AD5").value).toBe(500)
  })

  it("builds safe per-ward ZIP entry paths", () => {
    expect(sanitizeExportPathSegment("Ward 1 / A")).toBe("Ward-1-A")
    expect(wardSurveyDataZipEntry("801262", "001", "Ward 1")).toBe("801262/001-Ward-1.xlsx")
  })

  it("builds QC Final and Survey Data Ward_District filenames", () => {
    expect(buildExportFilename({ report: "qc_final", wardName: "Ward 1", districtName: "Etah" })).toBe(
      "QC_Final_Report_Ward-1_Etah.xlsx"
    )
    expect(buildExportFilename({ report: "survey_data", wardName: "Ward 1", districtName: "Etah" })).toBe(
      "Survey_Ward-1_Etah.xlsx"
    )
  })

  it("asserts export row counts match", () => {
    expect(() => assertExportRowCount(10, 10, "survey_data")).not.toThrow()
    expect(() => assertExportRowCount(9, 10, "qc_final")).toThrow(/row count mismatch/)
  })
})
