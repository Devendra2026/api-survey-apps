import {
  renderConvexFullWorkbook,
  renderNagarPanchayatWorkbook,
  renderSurveyDataWorkbook,
  type SurveyExportBundle,
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

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  const values = sheet.getRow(rowNumber).values
  if (!Array.isArray(values)) return []
  return values.slice(1).map((value) => (value == null ? "" : String(value)))
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
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await renderConvexFullWorkbook([bundle]))

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Surveys", "CoOwners", "Floors", "Photos", "Guide"])
    expect(workbook.getWorksheet("Surveys")?.getRow(1).values).toContain("Survey ID")
    expect(workbook.getWorksheet("Surveys")?.getRow(2).values).toContain(bundle.propertyId)
    expect(workbook.getWorksheet("CoOwners")?.getRow(2).values).toContain("Asha Devi")
  })

  it("matches golden Convex full export sheet names and headers when available", async () => {
    const golden = await loadGolden("C:/sdv-books/docs/surveys_full_2026-07-10.xlsx")
    if (!golden) return

    const generated = new ExcelJS.Workbook()
    await generated.xlsx.load(await renderConvexFullWorkbook([bundle]))

    expect(generated.worksheets.map((sheet) => sheet.name)).toEqual(golden.worksheets.map((sheet) => sheet.name))
    for (const name of ["Surveys", "CoOwners", "Floors", "Photos"] as const) {
      expect(rowValues(generated.getWorksheet(name)!, 1)).toEqual(rowValues(golden.getWorksheet(name)!, 1))
    }
  })

  it("renders Bakewar's Survey Data header order", async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await renderNagarPanchayatWorkbook([bundle]))

    const sheet = workbook.getWorksheet("Survey Data")
    expect(sheet?.getRow(1).values).toEqual(
      expect.arrayContaining(["SN", "Actions", "Status", "Surveyor Name", "Assessment Year", "Survey Id", "Floors"])
    )
    expect(sheet?.columnCount).toBe(45)
  })

  it("matches golden Nagar Panchayat headers when available", async () => {
    const golden = await loadGolden("E:/Sales/sdv-edutech/sdv-docs/Nagar-Panchayat-Bakewar-survey-data.xlsx")
    if (!golden) return

    const generated = new ExcelJS.Workbook()
    await generated.xlsx.load(await renderNagarPanchayatWorkbook([bundle]))
    const goldenSheet = golden.worksheets[0]
    const generatedSheet = generated.getWorksheet("Survey Data")
    expect(goldenSheet).toBeDefined()
    expect(generatedSheet).toBeDefined()
    expect(rowValues(generatedSheet!, 1)).toEqual(rowValues(goldenSheet!, 1))
    expect(rowValues(generatedSheet!, 1)).toHaveLength(45)
  })

  it("renders the four-row merged tax worksheet header", async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await renderSurveyDataWorkbook([bundle]))

    const sheet = workbook.getWorksheet("Survey Data")
    expect(sheet?.getCell("Q1").value).toBe("Floors")
    expect(sheet?.getCell("AO1").value).toBe("Total Demand")
    expect(sheet?.getCell("BJ1").value).toBe("Total Tax Demand")
    expect(sheet?.getCell("R2").value).toBe("Basement")
    expect(sheet?.getCell("AJ3").value).toBe("Open Land")
  })

  it("matches golden survey_data merged header labels when available", async () => {
    const golden = await loadGolden("E:/Sales/sdv-edutech/sdv-docs/survey_data (1).xlsx")
    if (!golden) return

    const generated = new ExcelJS.Workbook()
    await generated.xlsx.load(await renderSurveyDataWorkbook([bundle]))
    const goldenSheet = golden.worksheets[0]!
    const generatedSheet = generated.getWorksheet("Survey Data")!
    expect(String(generatedSheet.getCell("Q1").value ?? "")).toBe(String(goldenSheet.getCell("Q1").value ?? ""))
    expect(String(generatedSheet.getCell("AO1").value ?? "")).toBe(String(goldenSheet.getCell("AO1").value ?? ""))
    expect(String(generatedSheet.getCell("BJ1").value ?? "")).toBe(String(goldenSheet.getCell("BJ1").value ?? ""))
  })
})
