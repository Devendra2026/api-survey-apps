import { describe, expect, it } from "@jest/globals"
import {
  buildLifecycleFallback,
  buildSurveyAuditHistoryFromSources,
  collectAuditActorLookupKeys,
  formatAuditActionLabel,
  inferAuditRoleFromAction,
  mapLegacyAuditEventsToHistory,
  resolveLegacyEventActorName,
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

  it("prefers metadata.actorName over Nest user resolver", () => {
    const rows = mapLegacyAuditEventsToHistory(
      "PROP-1",
      [
        {
          eventId: "ev_created",
          action: "survey.created",
          occurredAt: new Date("2026-05-30T10:00:00.000Z"),
          actorId: "u1",
          resourceId: "convex_survey_1",
          metadata: { actorName: "Convex Snapshot Name", actorClerkId: "clerk_1" },
        },
      ],
      () => "Nest User From Clerk"
    )
    expect(rows[0]?.actor).toBe("Convex Snapshot Name")
  })

  it("resolves actor via Nest Users when metadata has only clerkId/email", () => {
    const byClerk: Record<string, string> = { clerk_abc: "Original Surveyor" }
    const rows = mapLegacyAuditEventsToHistory(
      "PROP-1",
      [
        {
          eventId: "ev_created",
          action: "survey.created",
          occurredAt: new Date("2026-05-30T10:00:00.000Z"),
          actorId: "convex_user_1",
          resourceId: "convex_survey_1",
          metadata: { actorClerkId: "clerk_abc" },
        },
      ],
      (event) => {
        const meta = event.metadata as { actorClerkId?: string }
        return meta.actorClerkId ? (byClerk[meta.actorClerkId] ?? null) : null
      }
    )
    expect(rows[0]?.actor).toBe("Original Surveyor")
    expect(rows[0]?.role).toBe("Surveyor")
  })

  it("returns dash when actor name cannot be resolved (never invents Nest creator)", () => {
    const event = {
      eventId: "ev_created",
      action: "survey.created",
      occurredAt: new Date("2026-05-30T10:00:00.000Z"),
      actorId: "u1",
      resourceId: "convex_survey_1",
      metadata: { actorClerkId: "missing_clerk" },
    }
    expect(resolveLegacyEventActorName(event)).toBe("—")
    expect(resolveLegacyEventActorName(event, () => null)).toBe("—")
  })

  it("infers role from action when metadata role is absent", () => {
    expect(inferAuditRoleFromAction("survey.created")).toBe("Surveyor")
    expect(inferAuditRoleFromAction("survey.submitted")).toBe("Surveyor")
    expect(inferAuditRoleFromAction("qc.approve")).toBe("QC")
    expect(inferAuditRoleFromAction("qc.reject")).toBe("QC")
    expect(inferAuditRoleFromAction("SURVEY_ASSIGNED")).toBe("—")

    const rows = mapLegacyAuditEventsToHistory("PROP-1", [
      {
        eventId: "ev_sub",
        action: "survey.submitted",
        occurredAt: new Date("2026-06-02T08:00:00.000Z"),
        actorId: "u1",
        resourceId: "s1",
        metadata: { actorName: "A" },
      },
      {
        eventId: "ev_app",
        action: "qc.approve",
        occurredAt: new Date("2026-07-01T12:00:00.000Z"),
        actorId: "u2",
        resourceId: "s1",
        metadata: { actorName: "B" },
      },
    ])
    expect(rows.find((r) => r.action === "Submitted")?.role).toBe("Surveyor")
    expect(rows.find((r) => r.action === "QC Approved")?.role).toBe("QC")
  })

  it("collects clerk/email keys only for events missing actorName", () => {
    const keys = collectAuditActorLookupKeys([
      {
        eventId: "1",
        action: "survey.created",
        occurredAt: new Date(),
        actorId: null,
        resourceId: null,
        metadata: { actorName: "Has Name", actorClerkId: "ignored" },
      },
      {
        eventId: "2",
        action: "survey.submitted",
        occurredAt: new Date(),
        actorId: null,
        resourceId: null,
        metadata: { actorClerkId: "clerk_x", actorEmail: "Person@Example.com" },
      },
    ])
    expect(keys.clerkIds).toEqual(["clerk_x"])
    expect(keys.emails).toEqual(["person@example.com"])
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

  it("shows dash for lifecycle actors when ETL system user is suppressed (null names)", () => {
    const rows = buildLifecycleFallback("PROP-1", {
      rowCreatedAt: new Date("2026-07-29T10:00:00.000Z"),
      capturedAt: new Date("2026-05-30T10:00:00.000Z"),
      submittedAt: new Date("2026-06-02T08:00:00.000Z"),
      creatorName: null,
      surveyorName: null,
    })
    expect(rows.find((r) => r.action === "Created")?.actor).toBe("—")
    expect(rows.find((r) => r.action === "Submitted")?.actor).toBe("—")
    expect(rows.some((r) => r.actor === "Tarun sikarwar")).toBe(false)
  })

  it("drops import seeds and uses lifecycle actors instead of importer name", () => {
    const rows = buildSurveyAuditHistoryFromSources({
      propertyId: "PROP-1",
      legacyEvents: [],
      audits: [
        {
          action: "IMPORTED",
          changedAt: new Date("2026-07-29T10:00:00.000Z"),
          changer: { fullName: "Migration Admin" },
        },
      ],
      lifecycle: {
        rowCreatedAt: new Date("2026-07-29T10:00:00.000Z"),
        capturedAt: new Date("2026-05-30T10:00:00.000Z"),
        submittedAt: new Date("2026-06-02T08:00:00.000Z"),
        creatorName: "Surveyor One",
        surveyorName: "Surveyor One",
      },
    })
    expect(rows.map((r) => r.action)).toEqual(["Submitted", "Created"])
    expect(rows.every((r) => r.actor === "Surveyor One")).toBe(true)
    expect(rows.some((r) => r.actor === "Migration Admin")).toBe(false)
  })

  it("formats known Convex verbs", () => {
    expect(formatAuditActionLabel("qc.approve")).toBe("QC Approved")
    expect(formatAuditActionLabel("survey.submitted")).toBe("Submitted")
  })
})
