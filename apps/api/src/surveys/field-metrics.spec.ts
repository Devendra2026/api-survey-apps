import { describe, expect, it } from "@jest/globals"
import { buildFieldMetrics, resolveTodayStart, type BuildFieldMetricsInput } from "./field-metrics.js"

const todayStart = new Date("2026-09-27T00:00:00.000Z")

function input(overrides: Partial<BuildFieldMetricsInput> = {}): BuildFieldMetricsInput {
  return {
    scope: "team",
    todayStart,
    statusRows: [
      { wardId: "w1", assignedToId: "u1", surveyStatus: "IN_PROGRESS", qcStatus: "PENDING", _count: { _all: 3 } },
      { wardId: "w1", assignedToId: "u1", surveyStatus: "SUBMITTED", qcStatus: "PENDING", _count: { _all: 2 } },
      { wardId: "w2", assignedToId: "u2", surveyStatus: "REJECTED", qcStatus: "REJECTED", _count: { _all: 1 } },
      { wardId: "w2", assignedToId: "u2", surveyStatus: "REOPENED", qcStatus: "REJECTED", _count: { _all: 1 } },
      { wardId: "w2", assignedToId: "u2", surveyStatus: "APPROVED", qcStatus: "APPROVED", _count: { _all: 4 } },
    ],
    createdTodayRows: [{ assignedToId: "u1", _count: { _all: 2 } }],
    submittedTodayRows: [
      { assignedToId: "u1", _count: { _all: 1 } },
      { assignedToId: "u2", _count: { _all: 1 } },
    ],
    resubmitted: 1,
    wards: [
      { id: "w1", wardNumber: "1", wardName: "Ward 1", ulbName: "ULB" },
      { id: "w2", wardNumber: "2", wardName: "Ward 2", ulbName: "ULB" },
    ],
    surveyors: [
      { userId: "u1", fullName: "Asha", wards: ["1"] },
      { userId: "u2", fullName: "Binod", wards: ["2"] },
      { userId: "u3", fullName: "Chetan", wards: ["2"] },
    ],
    lastActivityByUser: new Map([
      ["u1", new Date("2026-09-27T05:00:00.000Z")],
      ["u2", new Date("2026-09-26T18:00:00.000Z")],
    ]),
    assignedSurveyorCount: 3,
    ...overrides,
  }
}

describe("buildFieldMetrics", () => {
  it("folds grouped rows into lifecycle buckets and today counts", () => {
    const result = buildFieldMetrics(input())
    expect(result.totals).toEqual({
      fieldDraft: 3,
      pendingQc: 2,
      approved: 4,
      returned: 1,
      rework: 1,
      total: 11,
      createdToday: 2,
      submittedToday: 2,
      resubmitted: 1,
    })
    expect(result.wards.map((w) => [w.wardId, w.totals.total])).toEqual([
      ["w2", 6],
      ["w1", 5],
    ])
  })

  it("lists every assigned surveyor, including idle ones, and counts active today", () => {
    const result = buildFieldMetrics(input())
    expect(result.surveyors.map((s) => [s.userId, s.totals.total, s.submittedToday])).toEqual([
      ["u2", 6, 1],
      ["u1", 5, 1],
      ["u3", 0, 0],
    ])
    expect(result.activeSurveyorCount).toBe(1)
    expect(result.assignedSurveyorCount).toBe(3)
  })

  it("omits the surveyor breakdown for self scope", () => {
    const result = buildFieldMetrics(input({ scope: "self", assignedSurveyorCount: null }))
    expect(result.surveyors).toEqual([])
    expect(result.activeSurveyorCount).toBeNull()
  })
})

describe("resolveTodayStart", () => {
  const now = new Date("2026-09-27T10:00:00.000Z")

  it("accepts the client's local midnight within the last day", () => {
    expect(resolveTodayStart("2026-09-26T18:30:00.000Z", now).toISOString()).toBe("2026-09-26T18:30:00.000Z")
  })

  it("falls back to UTC midnight for invalid, future, or stale values", () => {
    for (const raw of [undefined, "nope", "2026-09-28T00:00:00.000Z", "2026-09-20T00:00:00.000Z"]) {
      expect(resolveTodayStart(raw, now).toISOString()).toBe("2026-09-27T00:00:00.000Z")
    }
  })
})
