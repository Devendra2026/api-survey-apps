import { describe, expect, it } from "@jest/globals"
import {
  assertExportRowCount,
  buildExportFilename,
  FIXED_HEADERS,
  renderConvexFullWorkbook,
  renderNagarPanchayatWorkbook,
  renderQcFinalWideWorkbook,
  renderSurveyDataWorkbook,
  renderSurveyDataWorkbookStreaming,
  sanitizeExportPathSegment,
  toQcFinalWideRow,
  toSurveyBaseRow,
  wardSurveyDataZipEntry,
  type SurveyExportBundle,
} from "@workspace/excel-reports"
import ExcelJS from "exceljs"

const bundle: SurveyExportBundle = {
  id: "survey-1",
  propertyId: "801262-001-00004-001-R",
  parcelNumber: "4",
  unitSubNo: "1",
  houseDoorNo: "12-A",
  propertyIdOld: "OLD-4",
  colony: "Arvdishali Nagar",
  pinCode: "271123",
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
  coOwners: [{ ownerIndex: 1, name: "Asha Devi", fatherOrHusbandName: "Ram Kumar", mobile: "9876543210" }],
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
    expect(sheet.getCell("R1").value).toBe("Floors")
    expect(sheet.getCell("AM1").value).toBe("Plot Area SqFt")
    expect(sheet.getCell("AO1").value).toBe("Total Built Up Area SqFt")
    expect(sheet.getCell("AP1").value).toBeNull()

    const headerRow = rowValues(sheet, 1).join("|")
    expect(headerRow).not.toContain("Total Demand")
    expect(headerRow).not.toContain("Total Tax Demand")
    expect(headerRow).not.toContain("Total Tax 10%")
    expect(headerRow).toContain("Unit Number")
    expect(headerRow).toContain("Old Property Number (House Number)")
    expect(headerRow).not.toContain("Property No")
    // All QC statuses included (header + 3 data rows)
    expect(sheet.rowCount).toBe(7)
  })

  it("renders QC Final wide sheet with blank tax placeholders", async () => {
    const workbook = await loadFromBuffer(await renderQcFinalWideWorkbook([bundle]))

    const sheet = workbook.getWorksheet("Survey Data")!
    expect(sheet.getCell("R1").value).toBe("Floors")
    expect(sheet.getCell("AP1").value).toBe("Total Demand")
    expect(sheet.getCell("BK1").value).toBe("Total Tax Demand")
    expect(sheet.getCell("BM3").value).toBe("Total Drainage Tax 2.5%")
    expect(sheet.getCell("AP5").value).toBe("")
    expect(sheet.getCell("BK5").value).toBe("")
  })

  it("streaming Survey Data matches buffer renderer key header cells", async () => {
    const streamed = await loadFromBuffer(await renderSurveyDataWorkbookStreaming([bundle]))
    const buffered = await loadFromBuffer(await renderSurveyDataWorkbook([bundle]))

    const streamedSheet = streamed.getWorksheet("Survey Data")!
    const bufferedSheet = buffered.getWorksheet("Survey Data")!
    expect(cellText(streamedSheet.getCell("R1").value)).toBe(cellText(bufferedSheet.getCell("R1").value))
    expect(cellText(streamedSheet.getCell("AM1").value)).toBe(cellText(bufferedSheet.getCell("AM1").value))
    expect(cellText(streamedSheet.getCell("AO1").value)).toBe(cellText(bufferedSheet.getCell("AO1").value))
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
    // Fifth floor residential = matrix index 6 → column 19 + 12 = 31 (AE)
    expect(sheet.getCell("AE5").value).toBe(500)
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

describe("Survey / QC shared base row mapping", () => {
  it("maps a complete record with padded parcel, unit number, and floor code", () => {
    const row = toSurveyBaseRow(bundle, 1)
    expect(FIXED_HEADERS).toEqual([
      "SN",
      "Survey Id",
      "Owner Name",
      "Owner Father Name",
      "Mobile No",
      "Ward Name",
      "Parcel No",
      "Unit Number",
      "City",
      "Pincode",
      "House No",
      "Old Property Number (House Number)",
      "Colony",
      "Tax Rate Zone",
      "Property Type",
      "Property Use",
      "Road Type",
    ])
    expect(row[0]).toBe(1)
    expect(row[1]).toBe("801262-001-00004-001-R")
    expect(row[2]).toBe("Asha Devi")
    expect(row[3]).toBe("Ram Kumar")
    expect(row[4]).toBe("9876543210")
    expect(row[6]).toBe("00004")
    expect(row[7]).toBe("001")
    expect(row[10]).toBe("12-A")
    expect(row[11]).toBe("OLD-4")
    expect(row[12]).toBe("Arvdishali Nagar")
    expect(row[17]).toBe("G")
  })

  it("applies N/A and mobile fallbacks and auto-generates Survey Id", () => {
    const sparse: SurveyExportBundle = {
      ...bundle,
      propertyId: "",
      parcelNumber: "595",
      unitSubNo: "1",
      propertyUse: "RESIDENTIAL",
      respondentName: null,
      mobileNumber: null,
      houseDoorNo: null,
      propertyIdOld: null,
      colony: null,
      coOwners: [],
      floors: [],
    }
    const row = toSurveyBaseRow(sparse, 2)
    expect(row[1]).toBe("801262-001-00595-001-R")
    expect(row[2]).toBe("N/A")
    expect(row[3]).toBe("N/A")
    expect(row[4]).toBe("0000000000")
    expect(row[6]).toBe("00595")
    expect(row[10]).toBe("N/A")
    expect(row[11]).toBe("N/A")
    expect(row[12]).toBe("N/A")
    expect(row[17]).toBe("P")
  })

  it("pads parcels 1 / 42 / 595 and builds GF1 / GF4 floor codes", () => {
    expect(toSurveyBaseRow({ ...bundle, parcelNumber: "1" }, 1)[6]).toBe("00001")
    expect(toSurveyBaseRow({ ...bundle, parcelNumber: "42" }, 1)[6]).toBe("00042")
    expect(toSurveyBaseRow({ ...bundle, parcelNumber: "595" }, 1)[6]).toBe("00595")

    const gf1 = toSurveyBaseRow(
      {
        ...bundle,
        floors: [
          { floorPosition: "GROUND_FLOOR", areaSqFt: 100 },
          { floorPosition: "FIRST_FLOOR", areaSqFt: 100 },
        ],
      },
      1
    )
    expect(gf1[17]).toBe("GF1")

    const gf4 = toSurveyBaseRow(
      {
        ...bundle,
        floors: [
          { floorPosition: "GROUND_FLOOR", areaSqFt: 100 },
          { floorPosition: "FOURTH_FLOOR", areaSqFt: 50 },
        ],
      },
      1
    )
    expect(gf4[17]).toBe("GF4")
  })

  it("keeps Survey Data and QC Final base cells identical for the same fixture", () => {
    const base = toSurveyBaseRow(bundle, 1)
    const qc = toQcFinalWideRow(bundle, 1)
    expect(qc.slice(0, base.length)).toEqual(base)
    expect(qc.length).toBe(base.length + 24)
  })
})
