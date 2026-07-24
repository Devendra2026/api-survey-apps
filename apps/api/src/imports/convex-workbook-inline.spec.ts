import { describe, expect, it } from "@jest/globals"
import { parseConvexWorkbook } from "@workspace/excel-reports"
import ExcelJS from "exceljs"

async function buildInlineSurveysWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Surveys")
  sheet.addRow([
    "Survey ID",
    "Local ID",
    "Property ID",
    "ULB Code",
    "Ward Number",
    "Parcel Number",
    "Unit / Sub-No",
    "Assessment Year",
    "Photos",
    "Floors",
    "CoOwners",
  ])
  sheet.addRow([
    "legacy-1",
    "L-1",
    "800726-001-00001-001-R",
    "800726",
    "001",
    "00001",
    "001",
    "2025-2026",
    "Front | https://api.sdvedutech.in/front.jpg; Side | https://api.sdvedutech.in/side.jpg",
    "0:ground_floor | self_occupied | tin_shed | Occupied | 420 | residential",
    JSON.stringify([{ name: "Asha Devi", fatherOrHusbandName: "Ram", mobileNo: "9999999999" }]),
  ])
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe("parseConvexWorkbook inline expansion", () => {
  it("expands Photos / Floors / CoOwners columns when child sheets are absent", async () => {
    const buffer = await buildInlineSurveysWorkbook()
    const parsed = await parseConvexWorkbook(buffer, "ward1-inline.xlsx")

    expect(parsed.surveys).toHaveLength(1)
    expect(parsed.usedInlineColumns).toBe(true)
    expect(parsed.photos).toHaveLength(2)
    expect(parsed.photos[0]?.["Photo URL"]).toContain("front.jpg")
    expect(parsed.floors).toHaveLength(1)
    expect(parsed.floors[0]?.Floor).toBe("ground_floor")
    expect(parsed.coOwners).toHaveLength(1)
    expect(parsed.coOwners[0]?.Name).toBe("Asha Devi")
  })
})
