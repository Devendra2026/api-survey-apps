import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { PortalSurveysRepository } from "./portal-surveys.repository.js"

describe("PortalSurveysRepository", () => {
  const surveyFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const prisma = {
    db: {
      survey: { findMany: surveyFindMany, count: surveyCount },
      ward: { findFirst: wardFindFirst },
    },
  }
  let repo: PortalSurveysRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new PortalSurveysRepository(prisma as never)
  })

  it("scopes to ulbId and excludes deleted surveys", async () => {
    surveyFindMany.mockResolvedValue([])
    surveyCount.mockResolvedValue(0)
    await repo.findAll("ulb-1", { page: 1, limit: 20 })
    expect(surveyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ulbId: "ulb-1", deletedAt: null }),
      })
    )
    expect(surveyCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ ulbId: "ulb-1", deletedAt: null }),
    })
  })

  it("rejects a ward that is not in the keyed ULB", async () => {
    wardFindFirst.mockResolvedValue(null)
    await expect(repo.findAll("ulb-1", { wardId: "ward-other" })).rejects.toBeInstanceOf(BadRequestException)
    await expect(repo.findAll("ulb-1", { wardId: "ward-other" })).rejects.toThrow("Ward is not in this ULB")
    expect(surveyFindMany).not.toHaveBeenCalled()
  })

  it("returns pagination meta", async () => {
    surveyFindMany.mockResolvedValue([
      {
        id: "s1",
        propertyId: "P-1",
        parcelNumber: "1",
        surveyStatus: "SUBMITTED",
        qcStatus: "PENDING",
        respondentName: "Ada",
        assessmentYear: "AY_2025_2026",
        ward: { id: "w1", wardNumber: "1", wardName: "Ward 1" },
      },
    ])
    surveyCount.mockResolvedValue(1)
    const result = await repo.findAll("ulb-1", { page: 1, limit: 20 })
    expect(result.items).toHaveLength(1)
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 })
    expect(result.items[0]?.propertyId).toBe("P-1")
  })
})
