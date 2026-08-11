import { describe, expect, it, jest } from "@jest/globals"
import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { SurveysRepository } from "./surveys.repository.js"

describe("SurveysRepository.findById", () => {
  const surveyRow = {
    id: "7052f15a-2aef-46f7-812a-b31e75093cbb",
    propertyId: "PROP-00595",
    legacySurveyId: "convex_survey_abc",
    stateId: "state-1",
    districtId: "district-1",
    ulbId: "ulb-1",
    wardId: "ward-1",
    deletedAt: null,
  }

  function makeRepo(findFirstImpl: jest.Mock) {
    const prisma = {
      db: {
        survey: {
          findFirst: findFirstImpl,
        },
      },
    }
    return new SurveysRepository(prisma as never)
  }

  const globalUser = {
    userId: "u1",
    clerkUserId: "clerk_1",
    email: "admin@example.com",
    fullName: "Admin",
    permissions: ["survey:approve"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "ADMIN",
        isActive: true,
        permissions: ["survey:approve"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
      },
    ],
  }

  const wardScopedUser = {
    ...globalUser,
    tenantRoles: [
      {
        id: "tr2",
        roleId: "r2",
        roleName: "QC",
        isActive: true,
        permissions: ["survey:approve"],
        stateId: "state-1",
        districtId: "district-1",
        ulbId: "ulb-1",
        wardId: "ward-other",
      },
    ],
  }

  it("resolves by Nest UUID id", async () => {
    const findFirst = jest.fn().mockResolvedValue(surveyRow)
    const repo = makeRepo(findFirst)
    const result = await repo.findById(surveyRow.id, globalUser as never)
    expect(result.id).toBe(surveyRow.id)
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ id: surveyRow.id }, { propertyId: surveyRow.id }, { legacySurveyId: surveyRow.id }],
        }),
      })
    )
  })

  it("resolves by legacy Convex survey id", async () => {
    const findFirst = jest.fn().mockResolvedValue(surveyRow)
    const repo = makeRepo(findFirst)
    await repo.findById("convex_survey_abc", globalUser as never)
    expect(findFirst).toHaveBeenCalled()
  })

  it("throws NotFound when survey does not exist", async () => {
    const repo = makeRepo(jest.fn().mockResolvedValue(null))
    await expect(repo.findById("missing", globalUser as never)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("throws Forbidden when survey exists outside tenant scope", async () => {
    const repo = makeRepo(jest.fn().mockResolvedValue(surveyRow))
    await expect(repo.findById(surveyRow.id, wardScopedUser as never)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
