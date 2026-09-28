import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { RejectSurveyDto } from "./dto/survey.dto.js"
import { buildQcRemarkRows } from "./qc-remarks.js"

describe("RejectSurveyDto corrections", () => {
  async function errorsFor(body: unknown) {
    return validate(plainToInstance(RejectSurveyDto, body))
  }

  it("accepts known sections", async () => {
    expect(
      await errorsFor({ qcRemarks: "Fix", corrections: [{ section: "owner", field: "Name", reason: "Incorrect" }] })
    ).toHaveLength(0)
  })

  it("rejects unknown sections and oversize lists", async () => {
    expect(await errorsFor({ qcRemarks: "Fix", corrections: [{ section: "admin", reason: "x" }] })).not.toHaveLength(0)
    const many = Array.from({ length: 21 }, () => ({ section: "gps", reason: "Missing" }))
    expect(await errorsFor({ qcRemarks: "Fix", corrections: many })).not.toHaveLength(0)
  })
})

describe("buildQcRemarkRows", () => {
  it("keeps the legacy single-remark behaviour when no corrections are sent", () => {
    expect(buildQcRemarkRows({ qcRemarks: "Wrong owner name" })).toEqual([
      { body: "Wrong owner name", section: null, field: null, reason: null },
    ])
  })

  it("falls back to the section id when an item has no field, note, or reason text", () => {
    expect(buildQcRemarkRows({ qcRemarks: "See items", corrections: [{ section: "gps", reason: "  " }] })).toEqual([
      { body: "See items", section: null, field: null, reason: null },
      { body: "gps", section: "gps", field: null, reason: null },
    ])
  })
})
