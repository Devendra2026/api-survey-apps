import {
  buildSurveyAuditHistoryFromSources,
  formatAuditActionLabel,
  mapLegacyAuditEventsToHistory,
} from "./survey-audit-history.js"

describe("survey audit history mapping", () => {
  it("maps Convex actions and preserves occurredAt ordering/actors", () => {
    const rows = mapLegacyAuditEventsToHistory("PROP-1", [
      {
        eventId: "ev_created",
        action: "survey.created",
        occurredAt: new Date("2026-05-30T10:00:00.000Z"),
        actorId: "u1",
        resourceId: "convex_survey_1",
        metadata: { actorName: "Surveyor One", actorRole: "Surveyor" },
      },
      {
        eventId: "ev_submitted",
        action: "survey.submitted",
        occurredAt: new Date("2026-06-02T08:00:00.000Z"),
        actorId: "u1",
        resourceId: "convex_survey_1",
        metadata: { actorName: "Surveyor One", actorRole: "Surveyor" },
      },
      {
        eventId: "ev_approved",
        action: "qc.approve",
        occurredAt: new Date("2026-07-01T12:00:00.000Z"),
        actorId: "u2",
        resourceId: "convex_survey_1",
        metadata: { actorName: "QC Reviewer", actorRole: "QC" },
      },
    ])

    expect(rows.map((r) => r.action)).toEqual(["QC Approved", "Submitted", "Created"])
    expect(rows[0]?.actor).toBe("QC Reviewer")
    expect(rows[2]?.when).toContain("30 May 2026")
    expect(rows[1]?.when).toContain("02 Jun 2026")
    expect(rows[0]?.when).toContain("01 Jul 2026")
  })

  it("prefers legacy audit_events over survey_audits and never invents Nest createdAt rows", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [
        {
          eventId: "ev_created",
          action: "survey.created",
          occurredAt: new Date("2026-05-30T10:00:00.000Z"),
          actorId: "u1",
          resourceId: "convex_survey_1",
          metadata: { actorName: "Legacy Surveyor" },
        },
      ],
      audits: [
        {
          action: "CREATED",
          changedAt: new Date("2026-07-29T10:00:00.000Z"),
          changer: { fullName: "Migration Admin" },
        },
      ],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe("Created")
    expect(rows[0]?.actor).toBe("Legacy Surveyor")
    expect(rows[0]?.when).toContain("30 May 2026")
    expect(rows[0]?.when).not.toContain("29 Jul 2026")
  })

  it("falls back to persisted audits only when legacy events are absent", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [],
      isLegacyMigratedSurvey: false,
      audits: [
        {
          action: "SUBMITTED",
          changedAt: new Date("2026-06-02T08:00:00.000Z"),
          changer: { fullName: "Surveyor One" },
          actorDisplayName: null,
        },
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe("Submitted")
  })

  it("drops synthetic import seeds for legacy surveys when audit_events are missing", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [],
      isLegacyMigratedSurvey: true,
      audits: [
        {
          action: "CREATED",
          changedAt: new Date("2026-07-29T10:00:00.000Z"),
          changer: { fullName: "Migration Admin" },
        },
        {
          action: "survey.qc_corrected",
          changedAt: new Date("2026-08-01T10:00:00.000Z"),
          changer: { fullName: "QC User" },
        },
      ],
    })
    expect(rows.map((r) => r.action)).toEqual(["QC Corrected"])
  })

  it("formats known Convex verbs", () => {
    expect(formatAuditActionLabel("qc.approve")).toBe("QC Approved")
    expect(formatAuditActionLabel("survey.submitted")).toBe("Submitted")
  })
})
