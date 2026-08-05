import { describe, expect, it } from "@jest/globals"
import { isStuckInProgress, nextRetryCount, shouldSkipSurvey, shouldSkipSurveyForRefresh } from "./resume.js"

describe("resume engine", () => {
  it("never restarts completed surveys", () => {
    expect(shouldSkipSurvey("COMPLETED")).toBe(true)
  })

  it("refresh skips terminal Nest QC only", () => {
    expect(shouldSkipSurveyForRefresh({ migrationStatus: "COMPLETED", nestQcStatus: "APPROVED" })).toBe(true)
    expect(shouldSkipSurveyForRefresh({ migrationStatus: "COMPLETED", nestQcStatus: "REJECTED" })).toBe(true)
    expect(shouldSkipSurveyForRefresh({ migrationStatus: "COMPLETED", nestQcStatus: "PENDING" })).toBe(false)
    expect(shouldSkipSurveyForRefresh({ migrationStatus: "COMPLETED", nestQcStatus: null })).toBe(false)
  })

  it("detects stuck IN_PROGRESS past TTL", () => {
    const now = Date.parse("2026-07-25T12:00:00.000Z")
    const row = {
      legacySurveyId: "x",
      status: "IN_PROGRESS" as const,
      updatedAt: new Date(now - 2 * 60 * 60 * 1000),
    }
    expect(isStuckInProgress(row, now, 60 * 60 * 1000)).toBe(true)
    expect(isStuckInProgress({ ...row, status: "FAILED" }, now, 60 * 60 * 1000)).toBe(false)
  })

  it("exhausts retries past max", () => {
    expect(nextRetryCount(4, 5)).toEqual({ retryCount: 5, exhausted: false })
    expect(nextRetryCount(5, 5)).toEqual({ retryCount: 6, exhausted: true })
  })
})
