import { describe, expect, it } from "@jest/globals"
import {
  assertExportRowCount,
  assertQcMandatoryFields,
  assertUniqueSurveyId,
  buildExportFilename,
  COMMON_SURVEY_COLUMNS,
  FIXED_HEADERS,
  FLOOR_EXPORT_POSITIONS,
  formatWardNumberAndName,
  QC_FINAL_COLUMNS,
  QC_FINAL_HEADERS,
  QC_PREMIUM_COLUMNS,
  renderConvexFullWorkbook,
  renderFlatWorkbook,
  renderNagarPanchayatWorkbook,
  renderQcFinalWideWorkbook,
  renderSurveyDataWorkbook,
  renderSurveyDataWorkbookStreaming,
  sanitizeExportPathSegment,
  SURVEY_CAPTURE_HEADERS,
  SURVEY_PREMIUM_COLUMNS,
  toCommonSurveyRow,
  toQcFinalWideRow,
  toSurveyCaptureRow,
  toSurveyPremiumRow,
  wardSurveyDataZipEntry,
  type SurveyExportBundle,
} from "@workspace/excel-reports"
import { taxRateKey, type ExportTaxRateTable } from "@workspace/validation"
import ExcelJS from "exceljs"

const bundle: SurveyExportBundle = {
  id: "survey-1",
  propertyId: "801262-001-00004-001-R",
  parcelNumber: "4",
  unitSubNo: "1",
  houseDoorNo: "12-A",
  propertyIdOld: "OLD-4",
  sectorNo: "3",
  constructedYear: 1998,
  isSlum: false,
  colony: "Arvdishali Nagar",
  locality: "Near Mandir",
  city: "Bakewar",
  pinCode: "271123",
  wardNumber: "001",
  respondentName: "Asha Devi",
  relationshipWithOwner: "SELF",
  mobileNumber: "9876543210",
  alternateMobile: "9123456780",
  familySize: 4,
  assessmentYear: "AY_2025_2026",
  ownershipType: "OWNED",
  taxRateZone: "ZONE_A",
  propertyUse: "RESIDENTIAL",
  propertyType: "PUCCA",
  situation: "MAIN_ROAD",
  roadType: "METALLED",
  waterConnection: "YES",
  sourceOfWater: "MUNICIPAL",
  sanitationType: "SEWER",
  solidWasteCollection: true,
  electricityConsumerNo: "012345",
  plotAreaSqFt: 1200,
  plinthAreaSqFt: 900,
  totalBuiltAreaSqFt: 100,
  latitude: 26.8,
  longitude: 79.0,
  surveyStatus: "APPROVED",
  qcStatus: "APPROVED",
  approvedAt: new Date("2026-07-20T00:00:00.000Z"),
  qcApprovedByName: "QC Officer",
  qcRemarks: "OK",
  createdAt: new Date("2026-07-14T00:00:00.000Z"),
  submittedAt: new Date("2026-07-15T00:00:00.000Z"),
  createdBy: { fullName: "Surveyor One", email: "surveyor@example.test" },
  ward: { wardName: "Ward 1", wardNumber: "001" },
  ulb: { name: "Bakewar", code: "801262" },
  district: { name: "Etawah" },
  coOwners: [{ ownerIndex: 1, name: "Asha Devi", fatherOrHusbandName: "Ram Kumar", mobile: "9876543210" }],
  floors: [
    {
      position: 0,
      floorPosition: "GROUND_FLOOR",
      areaSqFt: 100,
      usageFactor: "RESIDENTIAL",
      usageType: "RESIDENTIAL",
      constructionType: "RCC",
    },
  ],
  photos: [{ photoType: "FRONT", url: "https://example.test/front.jpg", sizeKB: 42 }],
}

const sampleRates: ExportTaxRateTable = {
  assessablePct: 80,
  propertyTaxPct: 10,
  waterTaxPct: 7.5,
  drainageTaxPct: 2.5,
  penaltyPct: 0,
  rateByZoneAndConstruction: new Map([[taxRateKey("ZONE_A", "RCC"), 10]]),
  anyRateByZone: new Map([["ZONE_A", 10]]),
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

  it("renders Word-baseline Survey Data with full floor pivot and no tax", async () => {
    const workbook = await loadFromBuffer(await renderSurveyDataWorkbook([bundle]))
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Survey Data"])
    const sheet = workbook.getWorksheet("Survey Data")!
    expect(sheet.autoFilter).toBeFalsy()
    expect(sheet.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1, xSplit: 2 })
    const headerRow = rowValues(sheet, 1)
    expect(headerRow[0]).toBe("S. No")
    expect(headerRow[1]).toBe("Survey ID")
    expect(headerRow).toContain("Ward Number and Name")
    expect(headerRow).not.toContain("Ward Number")
    expect(headerRow).not.toContain("Ward Name")
    for (const label of [
      "Assessment Year",
      "ULB Name",
      "Sector Number",
      "Plinth Area",
      "Source of Water",
      "Door-to-Door Collection",
      "Electricity Consumer No",
    ]) {
      expect(headerRow).toContain(label)
    }
    for (const floor of FLOOR_EXPORT_POSITIONS) {
      expect(headerRow).toContain(`${floor.label} Area`)
      expect(headerRow).toContain(`${floor.label} Usage Factor`)
      expect(headerRow).toContain(`${floor.label} Usage Type`)
      expect(headerRow).toContain(`${floor.label} Construction Type`)
    }
    expect(headerRow).not.toContain("GIS Status")
    expect(headerRow).not.toContain("Rain Water Harvesting")
    expect(headerRow).not.toContain("Category")
    expect(headerRow).not.toContain("Total Demand")
    expect(headerRow).not.toContain("Building Tax")
    expect(headerRow).not.toContain("Land Tax")
    expect(headerRow).not.toContain("Arrears")
    expect(headerRow).toEqual(COMMON_SURVEY_COLUMNS.map((c) => c.header))
    expect(COMMON_SURVEY_COLUMNS).toHaveLength(78)
    expect(sheet.getRow(2).getCell(1).value).toBe(1)
    expect(sheet.getRow(2).getCell(2).value).toBe(bundle.propertyId)
    const wardCol = headerRow.indexOf("Ward Number and Name") + 1
    expect(sheet.getRow(2).getCell(wardCol).value).toBe("001 - Ward 1")
    const parcelCol = headerRow.indexOf("Parcel Number") + 1
    expect(sheet.getRow(2).getCell(parcelCol).value).toBe("00004")
    expect(sheet.getRow(2).getCell(parcelCol).numFmt).toBe("@")
  })

  it("matches Ward-1-Etah headers after merging Ward Number + Ward Name", async () => {
    const golden = await loadGolden("C:/Users/sikar/Downloads/survey-data-district-ETA-wards/ETM/1-Ward-1-Etah.xlsx")
    if (!golden) return

    const refHeaders = rowValues(golden.getWorksheet("Survey Data")!, 1)
    const wardNoIdx = refHeaders.indexOf("Ward Number")
    const wardNameIdx = refHeaders.indexOf("Ward Name")
    expect(wardNoIdx).toBeGreaterThanOrEqual(0)
    expect(wardNameIdx).toBe(wardNoIdx + 1)
    const expected = [...refHeaders.slice(0, wardNoIdx), "Ward Number and Name", ...refHeaders.slice(wardNameIdx + 1)]
    expect(COMMON_SURVEY_COLUMNS.map((c) => c.header)).toEqual(expected)
  })

  it("sets AutoFilter when enableAutoFilter is true", async () => {
    const withFilter = await loadFromBuffer(await renderSurveyDataWorkbook([bundle], { enableAutoFilter: true }))
    const without = await loadFromBuffer(await renderSurveyDataWorkbook([bundle], { enableAutoFilter: false }))
    expect(withFilter.getWorksheet("Survey Data")!.autoFilter).toBeTruthy()
    expect(without.getWorksheet("Survey Data")!.autoFilter).toBeFalsy()

    const qcWith = await loadFromBuffer(
      await renderQcFinalWideWorkbook([bundle], { rates: sampleRates, enableAutoFilter: true })
    )
    expect(qcWith.getWorksheet("QC Final Report")!.autoFilter).toBeTruthy()
  })

  it("renders QC Final with shared survey prefix + ExportTaxSummary columns only", async () => {
    const incomplete = {
      ...bundle,
      coOwners: [],
      respondentName: null,
      parcelNumber: null,
    }
    const workbook = await loadFromBuffer(await renderQcFinalWideWorkbook([incomplete], { rates: sampleRates }))
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["QC Final Report"])
    const sheet = workbook.getWorksheet("QC Final Report")!
    expect(sheet.autoFilter).toBeFalsy()
    expect(sheet.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1, xSplit: 2 })
    const headers = rowValues(sheet, 1)
    expect(headers.slice(0, COMMON_SURVEY_COLUMNS.length)).toEqual(COMMON_SURVEY_COLUMNS.map((c) => c.header))
    expect(headers).toEqual(QC_FINAL_COLUMNS.map((c) => c.header))
    expect(headers).toContain("QC Status")
    expect(headers).toContain("QC Approved By")
    expect(headers).toContain("QC Approval Date")
    expect(headers).toContain("Total Demand")
    expect(headers).toContain("Building Tax")
    expect(headers).toContain("Current Demand")
    expect(headers).not.toContain("Land Tax")
    expect(headers).not.toContain("Conservancy")
    expect(headers).not.toContain("Arrears")
    expect(headers).not.toContain("Interest")
    expect(headers).not.toContain("Tax Category")
    const buildingCol = headers.indexOf("Building Tax") + 1
    const waterCol = headers.indexOf("Water Tax") + 1
    const drainageCol = headers.indexOf("Drainage Tax") + 1
    const currentCol = headers.indexOf("Current Demand") + 1
    const totalDemandCol = headers.indexOf("Total Demand") + 1
    const ownerCol = headers.indexOf("Owner Name") + 1
    const parcelCol = headers.indexOf("Parcel Number") + 1
    expect(Number(sheet.getRow(2).getCell(buildingCol).value)).toBe(80)
    expect(Number(sheet.getRow(2).getCell(waterCol).value)).toBe(60)
    expect(Number(sheet.getRow(2).getCell(drainageCol).value)).toBe(20)
    expect(Number(sheet.getRow(2).getCell(currentCol).value)).toBe(160)
    expect(Number(sheet.getRow(2).getCell(totalDemandCol).value)).toBe(160)
    expect(sheet.getRow(2).getCell(ownerCol).fill).toMatchObject({
      type: "pattern",
      fgColor: { argb: "FFFFC7CE" },
    })
    expect(sheet.getRow(2).getCell(parcelCol).note).toBe("Missing Required Data")
  })

  it("streaming Survey Data matches buffer renderer key cells", async () => {
    const streamed = await loadFromBuffer(await renderSurveyDataWorkbookStreaming([bundle]))
    const buffered = await loadFromBuffer(await renderSurveyDataWorkbook([bundle]))
    expect(cellText(streamed.getWorksheet("Survey Data")!.getCell("B2").value)).toBe(
      cellText(buffered.getWorksheet("Survey Data")!.getCell("B2").value)
    )
  })

  it("maps legacy FIFTH_FLOOR_PLUS into Survey Data floor columns", () => {
    const legacy = {
      ...bundle,
      floors: [{ position: 0, floorPosition: "FIFTH_FLOOR_PLUS", areaSqFt: 500, usageFactor: "RESIDENTIAL" }],
    }
    const row = toSurveyCaptureRow(legacy, 1)
    const fifthResiIndex = SURVEY_CAPTURE_HEADERS.indexOf("Fifth Floor Residential")
    expect(row[fifthResiIndex]).toBe(500)
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

describe("Survey / QC shared capture mapping", () => {
  it("maps a complete capture record", () => {
    const row = toSurveyCaptureRow(bundle, 1)
    expect(FIXED_HEADERS[0]).toBe("SN")
    expect(row[1]).toBe("801262-001-00004-001-R")
    expect(row[SURVEY_CAPTURE_HEADERS.indexOf("Parcel No")]).toBe("00004")
    expect(row[SURVEY_CAPTURE_HEADERS.indexOf("Unit Number")]).toBe("001")
    expect(row[SURVEY_CAPTURE_HEADERS.indexOf("Floors")]).toBe("G")
    expect(row[SURVEY_CAPTURE_HEADERS.indexOf("Surveyor Name")]).toBe("Surveyor One")
  })

  it("hard-fails duplicate Survey Ids", () => {
    const seen = new Set<string>()
    assertUniqueSurveyId(seen, "A-1", "survey_data")
    expect(() => assertUniqueSurveyId(seen, "A-1", "survey_data")).toThrow(/duplicate Survey Id/)
    expect(() => assertUniqueSurveyId(seen, "N/A", "survey_data")).toThrow(/blank Survey Id/)
  })

  it("hard-fails QC blank owner/parcel", () => {
    expect(() =>
      assertQcMandatoryFields(
        { ...bundle, coOwners: [], respondentName: null, parcelNumber: null },
        "801262-001-00004-001-R"
      )
    ).toThrow(/blank Owner Name/)
  })

  it("keeps QC Final common prefix identical to Survey common row", () => {
    const common = toCommonSurveyRow(bundle, 1)
    const premiumSurvey = toSurveyPremiumRow(bundle, 1)
    const qc = toQcFinalWideRow(bundle, 1, {
      propertyTax: 80,
      waterTax: 60,
      drainageTax: 20,
      penalty: 0,
      totalDemand: 160,
    })
    expect(premiumSurvey).toEqual(common)
    expect(qc.slice(0, common.length)).toEqual(common)
    expect(qc.length).toBe(QC_PREMIUM_COLUMNS.length)
    expect(SURVEY_PREMIUM_COLUMNS.length).toBe(common.length)
    expect(COMMON_SURVEY_COLUMNS.length).toBe(common.length)
    expect(QC_FINAL_HEADERS.length).toBe(SURVEY_CAPTURE_HEADERS.length + 9)
  })

  it("reconciles Survey and QC Final floor columns and values identically", async () => {
    const multiFloor: SurveyExportBundle = {
      ...bundle,
      floors: [
        {
          position: 0,
          floorPosition: "GROUND_FLOOR",
          areaSqFt: 800,
          usageFactor: "RESIDENTIAL",
          usageType: "SELF",
          constructionType: "RCC",
        },
        {
          position: 1,
          floorPosition: "FIRST_FLOOR",
          areaSqFt: 500,
          usageFactor: "RESIDENTIAL",
          usageType: "SELF",
          constructionType: "RCC",
        },
      ],
    }

    const surveyWb = await loadFromBuffer(await renderSurveyDataWorkbook([multiFloor]))
    const qcWb = await loadFromBuffer(await renderQcFinalWideWorkbook([multiFloor], { rates: sampleRates }))
    const surveyHeaders = rowValues(surveyWb.getWorksheet("Survey Data")!, 1)
    const qcHeaders = rowValues(qcWb.getWorksheet("QC Final Report")!, 1)

    const plotIdx = surveyHeaders.indexOf("Plot Area")
    const waterIdx = surveyHeaders.indexOf("Water Connection")
    expect(plotIdx).toBeGreaterThanOrEqual(0)
    expect(waterIdx).toBeGreaterThan(plotIdx)

    const surveyFloorHeaders = surveyHeaders.slice(plotIdx, waterIdx)
    const qcFloorHeaders = qcHeaders.slice(plotIdx, waterIdx)
    expect(qcFloorHeaders).toEqual(surveyFloorHeaders)
    expect(surveyFloorHeaders[0]).toBe("Plot Area")
    expect(surveyFloorHeaders[1]).toBe("Plinth Area")
    expect(surveyFloorHeaders[2]).toBe("Total Built-up Area")
    expect(surveyFloorHeaders).toContain("Basement Area")
    expect(surveyFloorHeaders).toContain("Ground Floor Area")
    expect(surveyFloorHeaders).toContain("First Floor Area")
    expect(surveyFloorHeaders).toContain("Open Land Construction Type")

    const surveyRow = rowValues(surveyWb.getWorksheet("Survey Data")!, 2)
    const qcRow = rowValues(qcWb.getWorksheet("QC Final Report")!, 2)
    expect(qcRow.slice(0, surveyRow.length)).toEqual(surveyRow)

    const gfAreaIdx = surveyHeaders.indexOf("Ground Floor Area")
    const basementAreaIdx = surveyHeaders.indexOf("Basement Area")
    expect(surveyRow[gfAreaIdx]).toBe("800")
    expect(surveyRow[surveyHeaders.indexOf("First Floor Area")]).toBe("500")
    expect(surveyRow[basementAreaIdx]).toBe("")
    expect(surveyRow[surveyHeaders.indexOf("Basement Usage Factor")]).toBe("N/A")
  })

  it("preserves leading-zero parcel and unit as text IDs", () => {
    const row = toCommonSurveyRow({ ...bundle, parcelNumber: "4", unitSubNo: "1", pinCode: "012345" }, 1)
    expect(row[COMMON_SURVEY_COLUMNS.findIndex((c) => c.header === "Parcel Number")]).toBe("00004")
    expect(row[COMMON_SURVEY_COLUMNS.findIndex((c) => c.header === "Unit Number")]).toBe("001")
    expect(row[COMMON_SURVEY_COLUMNS.findIndex((c) => c.header === "PIN Code")]).toBe("012345")
  })

  it("formats Ward Number and Name as a single combined value", () => {
    expect(formatWardNumberAndName("1", "Ward 1 - Etah")).toBe("1 - Ward 1 - Etah")
    expect(formatWardNumberAndName("001", "Ward 1")).toBe("001 - Ward 1")
    expect(formatWardNumberAndName(null, null)).toBe("N/A")
    expect(
      toCommonSurveyRow(bundle, 1)[COMMON_SURVEY_COLUMNS.findIndex((c) => c.header === "Ward Number and Name")]
    ).toBe("001 - Ward 1")
  })
})

describe("workbook shell", () => {
  it("writes optional title then single header row", async () => {
    const buffer = await renderFlatWorkbook({
      sheetName: "T",
      title: "Title",
      headers: ["A", "B"],
      columnKinds: ["text", "number"],
      rows: [["x", 1]],
    })
    const workbook = await loadFromBuffer(buffer)
    const sheet = workbook.getWorksheet("T")!
    expect(sheet.getCell("A1").value).toBe("Title")
    expect(sheet.getCell("A2").value).toBe("A")
    expect(sheet.getCell("A3").value).toBe("x")
    expect(sheet.autoFilter).toBeTruthy()
  })
})
