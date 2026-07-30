import { describe, expect, it } from "@jest/globals"
import { classifySurveyBucket, tallySurveyBuckets, type SurveyStatusRow } from "./survey-bucket.util.js"

const row = (surveyStatus: SurveyStatusRow["surveyStatus"], qcStatus: SurveyStatusRow["qcStatus"], count: number) =>
  ({ surveyStatus, qcStatus, _count: { _all: count } }) satisfies SurveyStatusRow

describe("classifySurveyBucket", () => {
  it("treats drafts and in-progress surveys as field drafts", () => {
    expect(classifySurveyBucket({ surveyStatus: "DRAFT", qcStatus: "PENDING" })).toBe("fieldDraft")
    expect(classifySurveyBucket({ surveyStatus: "IN_PROGRESS", qcStatus: "PENDING" })).toBe("fieldDraft")
  })

  it("separates returned from rework", () => {
    expect(classifySurveyBucket({ surveyStatus: "REJECTED", qcStatus: "REJECTED" })).toBe("returned")
    expect(classifySurveyBucket({ surveyStatus: "REOPENED", qcStatus: "REJECTED" })).toBe("rework")
  })

  it("honours a legacy QC decision on a still-SUBMITTED survey", () => {
    expect(classifySurveyBucket({ surveyStatus: "SUBMITTED", qcStatus: "APPROVED" })).toBe("approved")
    expect(classifySurveyBucket({ surveyStatus: "SUBMITTED", qcStatus: "REJECTED" })).toBe("returned")
    expect(classifySurveyBucket({ surveyStatus: "SUBMITTED", qcStatus: "PENDING" })).toBe("pendingQc")
  })
})

describe("tallySurveyBuckets", () => {
  it("keeps buckets disjoint so they sum to the total", () => {
    const totals = tallySurveyBuckets([
      row("DRAFT", "PENDING", 4),
      row("IN_PROGRESS", "PENDING", 1),
      row("SUBMITTED", "PENDING", 10),
      row("SUBMITTED", "APPROVED", 2),
      row("APPROVED", "APPROVED", 3),
      row("REJECTED", "REJECTED", 5),
      row("REOPENED", "REJECTED", 6),
    ])

    expect(totals).toEqual({
      fieldDraft: 5,
      pendingQc: 10,
      approved: 5,
      returned: 5,
      rework: 6,
      total: 31,
    })
    expect(totals.fieldDraft + totals.pendingQc + totals.approved + totals.returned + totals.rework).toBe(totals.total)
  })

  it("returns zeroed totals for an empty group-by", () => {
    expect(tallySurveyBuckets([])).toEqual({
      fieldDraft: 0,
      pendingQc: 0,
      approved: 0,
      returned: 0,
      rework: 0,
      total: 0,
    })
  })
})
