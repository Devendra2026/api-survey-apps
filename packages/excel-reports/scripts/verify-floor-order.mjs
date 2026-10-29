import { formatExportFloorDetails } from "@workspace/validation"
import ExcelJS from "exceljs"
import { renderSurveyDataWorkbook } from "../dist/index.js"

const floors = [
  {
    floorPosition: "FIRST_FLOOR",
    areaSqFt: 4480,
    usageFactor: "RESIDENTIAL",
    usageType: "SELF_OCCUPIED",
    constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
  },
  {
    floorPosition: "GROUND_FLOOR",
    areaSqFt: 4480,
    usageFactor: "RESIDENTIAL",
    usageType: "SELF_OCCUPIED",
    constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
  },
  {
    floorPosition: "THIRD_FLOOR",
    areaSqFt: 100,
    usageFactor: "COMMERCIAL",
    usageType: "RENTED",
    constructionType: "TIN_SHED",
  },
]

const narrative = formatExportFloorDetails(floors)
const narrativeLines = narrative.split(",\n")
const narrativeOk =
  narrativeLines[0]?.startsWith("Ground Floor") === true &&
  narrativeLines[1]?.startsWith("First Floor") === true &&
  narrativeLines[2]?.startsWith("Third Floor") === true

const row = {
  id: "s1",
  propertyId: "801262-001-00004-001-R",
  parcelNumber: "4",
  unitSubNo: "1",
  assessmentYear: "2025-26",
  surveyStatus: "APPROVED",
  propertyUse: "RESIDENTIAL",
  propertyType: "BUILT_UP",
  plotAreaSqFt: 4480,
  plinthAreaSqFt: 4480,
  totalBuiltAreaSqFt: 9060,
  coOwners: [{ name: "Test", fatherOrHusbandName: "X", mobile: "9876543210" }],
  floors,
  photos: [],
  ward: { wardName: "Ambedkar Nagar", wardNumber: "2" },
  ulb: { name: "Test", code: "801262" },
  createdBy: { fullName: "Surveyor", email: "a@b.c" },
}

const buf = await renderSurveyDataWorkbook([row])
const wb = new ExcelJS.Workbook()
await wb.xlsx.load(buf)
const sheet = wb.getWorksheet("Survey Data")
const headers = []
sheet.getRow(1).eachCell((c, i) => {
  headers[i] = c.value
})
const floorsCol = headers.indexOf("Floors")
const propertyIdCol = headers.indexOf("Property Id")
const cell = String(sheet.getRow(2).getCell(floorsCol).value ?? "")
const excelLines = cell.split(",\n")
const excelOk =
  excelLines[0]?.startsWith("Ground Floor") === true &&
  excelLines[1]?.startsWith("First Floor") === true &&
  excelLines[2]?.startsWith("Third Floor") === true

console.log(
  JSON.stringify(
    {
      narrativeOk,
      excelOk,
      propertyId: sheet.getRow(2).getCell(propertyIdCol).value,
      floorsCol,
      excelPositions: excelLines.map((line) => line.split(" - ")[0]),
      parcelImages: Boolean(wb.getWorksheet("Parcel Images")),
    },
    null,
    2
  )
)

if (!narrativeOk || !excelOk) {
  process.exitCode = 1
}
