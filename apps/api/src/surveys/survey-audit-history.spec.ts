import { describe, expect, it } from "@jest/globals"
import {
  buildSurveyAuditHistoryFromSources,
  formatAuditActionLabel,
  mapLegacyAuditEventsToHistory,
} from "./survey-audit-history.js"

/** Mirror production `formatWhen` so assertions stay stable across CI timezones. */
function expectedWhen(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

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
    expect(rows[0]?.when).toBe(expectedWhen("2026-07-01T12:00:00.000Z"))
    expect(rows[1]?.when).toBe(expectedWhen("2026-06-02T08:00:00.000Z"))
    expect(rows[2]?.when).toBe(expectedWhen("2026-05-30T10:00:00.000Z"))
  })

  it("prefers legacy audit_events over survey_audits", () => {
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
    expect(rows[0]?.actor).toBe("Legacy Surveyor")
    expect(rows[0]?.when).toBe(expectedWhen("2026-05-30T10:00:00.000Z"))
    expect(rows[0]?.when).not.toBe(expectedWhen("2026-07-29T10:00:00.000Z"))
  })

  it("falls back to persisted audits when legacy events are absent", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [],
      audits: [
        {
          action: "SUBMITTED",
          changedAt: new Date("2026-06-02T08:00:00.000Z"),
          changer: { fullName: "Surveyor One" },
        },
        {
          action: "CREATED",
          changedAt: new Date("2026-05-30T10:00:00.000Z"),
          changer: { fullName: "Surveyor One" },
        },
      ],
    })
    expect(rows.map((r) => r.action)).toEqual(["Submitted", "Created"])
  })

  it("falls back to Convex-preserved lifecycle timestamps when audits are empty", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [],
      audits: [],
      lifecycle: {
        rowCreatedAt: new Date("2026-07-29T10:00:00.000Z"),
        capturedAt: new Date("2026-05-30T10:00:00.000Z"),
        submittedAt: new Date("2026-06-02T08:00:00.000Z"),
        approvedAt: new Date("2026-07-01T12:00:00.000Z"),
        creatorName: "Surveyor One",
        surveyorName: "Surveyor One",
      },
    })
    expect(rows.map((r) => r.action)).toEqual(["QC Approved", "Submitted", "Created"])
    expect(rows[2]?.when).toBe(expectedWhen("2026-05-30T10:00:00.000Z"))
    expect(rows[2]?.when).not.toBe(expectedWhen("2026-07-29T10:00:00.000Z"))
  })

  it("formats known Convex verbs", () => {
    expect(formatAuditActionLabel("qc.approve")).toBe("QC Approved")
    expect(formatAuditActionLabel("survey.submitted")).toBe("Submitted")
  })
})
