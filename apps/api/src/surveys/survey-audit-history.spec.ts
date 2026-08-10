import { buildSurveyAuditHistory } from "./survey-view.mapper.js"

describe("buildSurveyAuditHistory", () => {
  const baseSurvey = {
    propertyId: "ULB-01-001-R",
    createdAt: new Date("2026-01-10T10:00:00.000Z"),
    submittedAt: new Date("2026-01-11T12:00:00.000Z"),
    approvedAt: null as Date | null,
    rejectedAt: null as Date | null,
    surveyStatus: "SUBMITTED",
    qcStatus: "PENDING",
    createdBy: { fullName: "Creator User" },
    assignedTo: { fullName: "Surveyor User" },
  }

  it("falls back to lifecycle Created/Submitted when survey_audits is empty", () => {
    const rows = buildSurveyAuditHistory(baseSurvey, [])
    expect(rows.map((r) => r.action)).toEqual(["Submitted", "Created"])
    expect(rows[0]?.actor).toBe("Surveyor User")
    expect(rows[1]?.actor).toBe("Creator User")
  })

  it("does not duplicate lifecycle rows already present in audits", () => {
    const rows = buildSurveyAuditHistory(baseSurvey, [
      {
        action: "CREATED",
        changedAt: new Date("2026-01-10T10:00:00.000Z"),
        changer: { fullName: "Creator User" },
      },
      {
        action: "SUBMITTED",
        changedAt: new Date("2026-01-11T12:00:00.000Z"),
        changer: { fullName: "Surveyor User" },
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.action)).toEqual(["Submitted", "Created"])
  })

  it("adds Approved fallback when approvedAt is set and no APPROVED audit exists", () => {
    const rows = buildSurveyAuditHistory(
      {
        ...baseSurvey,
        surveyStatus: "APPROVED",
        qcStatus: "APPROVED",
        approvedAt: new Date("2026-01-12T09:00:00.000Z"),
      },
      [
        {
          action: "SUBMITTED",
          changedAt: new Date("2026-01-11T12:00:00.000Z"),
          changer: { fullName: "Surveyor User" },
        },
      ]
    )
    expect(rows.map((r) => r.action)).toEqual(["Approved", "Submitted", "Created"])
  })
})
