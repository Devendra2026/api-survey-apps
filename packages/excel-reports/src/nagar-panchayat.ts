import ExcelJS from "exceljs"
import { createWorkbook, date, display, number, text, toBuffer, yesNo } from "./convex-full.js"
import type { SurveyExportBundle } from "./types.js"

export const NAGAR_PANCHAYAT_HEADERS = [
  "SN",
  "Actions",
  "Status",
  "Surveyor Name",
  "Assessment Year",
  "Survey Id",
  "Date of Survey",
  "Owner Name",
  "Owner Father Name",
  "Mobile No",
  "Ward Name",
  "Is Slum",
  "Parcel No",
  "Property No",
  "Constructed Year",
  "Respondent Name",
  "Respondent Relationship",
  "City",
  "Pincode",
  "House No",
  "Street Name",
  "Colony",
  "House No",
  "Street Name",
  "Locality",
  "Tax Rate Zone",
  "Property Ownership",
  "Property Type",
  "Property Uses",
  "Situation",
  "Road Type",
  "Floors",
  "Plot Area SqFt",
  "Plot Area SqMeter",
  "Plinth Area SqFt",
  "Plinth Area SqMeter",
  "Total Built Up Area SqFt",
  "Total Built Up Area SqMeter",
  "Is Muncipal Water Supply",
  "Total Water Connection",
  "Water Connection Id/Type",
  "Toilet Type",
  "Is Muncipal Waste Service",
  "Is Muncipal Water Supply",
  "Is Muncipal Water Supply",
] as const

export async function renderNagarPanchayatWorkbook(rows: SurveyExportBundle[]): Promise<Buffer> {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet("Survey Data", { views: [{ state: "frozen", ySplit: 1 }] })
  sheet.addRow(NAGAR_PANCHAYAT_HEADERS)
  for (const [index, row] of rows.entries()) sheet.addRow(toNagarPanchayatRow(row, index + 1))

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true }
  sheet.getRow(1).height = 30
  sheet.columns.forEach((column, index) => {
    column.width = index === 31 ? 80 : Math.min(Math.max(NAGAR_PANCHAYAT_HEADERS[index]?.length ?? 12, 12), 32)
  })
  return toBuffer(workbook)
}

export function toNagarPanchayatRow(row: SurveyExportBundle, serialNumber: number): unknown[] {
  const owner = row.coOwners[0]
  return [
    serialNumber,
    "",
    row.surveyStatus === "APPROVED" ? "Completed" : display(row.surveyStatus),
    text(row.createdBy?.fullName),
    display(row.assessmentYear).replace("Ay ", ""),
    row.propertyId,
    date(row.submittedAt ?? row.createdAt),
    text(owner?.name ?? row.respondentName),
    text(owner?.fatherOrHusbandName),
    text(owner?.mobile ?? row.mobileNumber),
    text(row.ward?.wardName ?? row.wardNumber),
    yesNo(row.isSlum).toLowerCase(),
    text(row.parcelNumber),
    row.propertyId,
    row.constructedYear ?? "",
    text(row.respondentName),
    text(row.relationshipWithOwner),
    text(row.city ?? row.ulb?.name),
    text(row.pinCode),
    text(row.houseDoorNo),
    text(row.locality),
    text(row.colony),
    text(row.houseDoorNo),
    text(row.locality),
    text(row.colony ?? row.locality),
    display(row.taxRateZone),
    display(row.ownershipType),
    display(row.propertyType),
    display(row.propertyUse),
    display(row.situation),
    display(row.roadType),
    row.floors.map(floorSummary).join(",\n"),
    number(row.plotAreaSqFt),
    number(row.plotAreaSqMeter),
    number(row.plinthAreaSqFt),
    number(row.plinthAreaSqMeter),
    number(row.totalBuiltAreaSqFt),
    number(row.totalBuiltAreaSqMeter),
    yesNo(row.waterConnection === "YES").toLowerCase(),
    "",
    text(row.sourceOfWater),
    display(row.sanitationType),
    yesNo(row.solidWasteCollection).toLowerCase(),
    yesNo(row.waterConnection === "YES").toLowerCase(),
    display(row.sourceOfWater),
  ]
}

function floorSummary(floor: SurveyExportBundle["floors"][number]): string {
  return [
    `${display(floor.floorPosition)} - ${number(floor.areaSqFt) || 0} SqFt`,
    `Usage Type - ${display(floor.usageType)}`,
    `Usage Factor - ${display(floor.usageFactor)}`,
    `Construction Type - ${display(floor.constructionType)}`,
  ].join(" || ")
}

export function isNagarPanchayatSheet(sheet: ExcelJS.Worksheet): boolean {
  return sheet.name === "Survey Data" && sheet.getRow(1).getCell(1).value === "SN"
}
