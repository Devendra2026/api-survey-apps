import { describe, expect, it, jest } from "@jest/globals"
import { ConflictException } from "@nestjs/common"
import {
  allocateTempPropertyId,
  assertActiveSurveyIdentityAvailable,
  findActiveSurveyIdentityConflict,
  isPrismaUniqueConflict,
  surveyIdentityConflictMessage,
} from "./survey-identity.util.js"

describe("survey-identity.util", () => {
  it("formats conflict message with propertyId and peer survey id", () => {
    expect(surveyIdentityConflictMessage("800726-001-00001-001-R", "peer-1")).toBe(
      "Property ID 800726-001-00001-001-R already exists for this ULB and assessment year (survey peer-1)."
    )
  })

  it("allocates TEMP-SWAP and TEMP-RESTORE ids", () => {
    expect(allocateTempPropertyId("TEMP-SWAP")).toMatch(/^TEMP-SWAP-[0-9a-f-]{36}$/i)
    expect(allocateTempPropertyId("TEMP-RESTORE")).toMatch(/^TEMP-RESTORE-[0-9a-f-]{36}$/i)
  })

  it("detects Prisma P2002 unique conflicts", () => {
    expect(isPrismaUniqueConflict({ code: "P2002" })).toBe(true)
    expect(isPrismaUniqueConflict({ code: "P2025" })).toBe(false)
    expect(isPrismaUniqueConflict(null)).toBe(false)
  })

  it("findActiveSurveyIdentityConflict queries active rows excluding self", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "peer" } as never)
    const db = { survey: { findFirst } }
    await findActiveSurveyIdentityConflict(db as never, {
      ulbId: "ulb-1",
      propertyId: "pid",
      assessmentYear: "AY_2025_2026",
      excludeId: "self",
    })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ulbId: "ulb-1",
          propertyId: "pid",
          assessmentYear: "AY_2025_2026",
          deletedAt: null,
          NOT: { id: "self" },
        }),
      })
    )
  })

  it("assertActiveSurveyIdentityAvailable throws ConflictException", async () => {
    const db = {
      survey: {
        findFirst: jest.fn().mockResolvedValue({ id: "peer-9", propertyId: "pid" } as never),
      },
    }
    await expect(
      assertActiveSurveyIdentityAvailable(db as never, {
        ulbId: "ulb-1",
        propertyId: "pid",
        assessmentYear: "AY_2025_2026",
      })
    ).rejects.toBeInstanceOf(ConflictException)
  })
})
