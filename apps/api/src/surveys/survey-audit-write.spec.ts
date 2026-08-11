import { describe, expect, it, jest } from "@jest/globals"
import { createSurveyAuditRow } from "./survey-audit-write.js"

describe("createSurveyAuditRow", () => {
  it("inserts only pre-migration survey_audits columns", async () => {
    const db = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1 as never),
    }

    const result = await createSurveyAuditRow(db, {
      surveyId: "survey-1",
      action: "APPROVED",
      changedBy: "user-1",
      oldValue: { surveyStatus: "SUBMITTED" },
      newValue: { surveyStatus: "APPROVED" },
    })

    expect(result.id).toMatch(/^c[a-f0-9]+$/)
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1)
    const [sql, id, surveyId, action, oldJson, newJson, changedBy, changedAt] = db.$executeRawUnsafe.mock
      .calls[0] as unknown[]
    expect(sql).toContain('"changedAt"')
    expect(sql).not.toContain("sourceEventId")
    expect(sql).not.toContain("createdAt")
    expect(sql).not.toContain("actorDisplayName")
    expect(id).toBe(result.id)
    expect(surveyId).toBe("survey-1")
    expect(action).toBe("APPROVED")
    expect(oldJson).toContain("SUBMITTED")
    expect(newJson).toContain("APPROVED")
    expect(changedBy).toBe("user-1")
    expect(changedAt).toBeInstanceOf(Date)
  })
})
