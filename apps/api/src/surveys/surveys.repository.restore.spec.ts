import { describe, expect, it, jest } from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import { SurveysRepository } from "./surveys.repository.js"

describe("SurveysRepository.restore", () => {
  const deletedSurvey = {
    id: "survey-del",
    deletedAt: new Date("2026-07-01T00:00:00.000Z"),
    ulbId: "ulb-1",
    propertyId: "800726-001-00082-001-R",
    assessmentYear: "AY_2025_2026",
    propertyIdOld: null,
  }

  const user = {
    id: "admin-1",
    tenantRoles: [],
  }

  function makeRepo(opts: { conflict: { id: string } | null }) {
    const tx = {
      survey: {
        findFirst: jest.fn().mockResolvedValue(opts.conflict as never),
        update: jest.fn().mockImplementation((args: unknown) => {
          const data =
            typeof args === "object" && args !== null && "data" in args
              ? (args as { data: Record<string, unknown> }).data
              : {}
          return {
            ...deletedSurvey,
            deletedAt: null,
            propertyId: (data.propertyId as string | undefined) ?? deletedSurvey.propertyId,
            propertyIdOld: (data.propertyIdOld as string | null | undefined) ?? deletedSurvey.propertyIdOld,
          }
        }),
      },
      surveyAudit: { create: jest.fn().mockResolvedValue({} as never) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1 as never),
    }

    const prisma = {
      db: {
        survey: {
          findFirst: jest.fn().mockResolvedValue(deletedSurvey as never),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      },
    }

    return { repo: new SurveysRepository(prisma as never), tx, prisma }
  }

  it("restores without re-key when identity is free", async () => {
    const { repo, tx } = makeRepo({ conflict: null })
    const result = await repo.restore(deletedSurvey.id, user as never)

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: null },
      })
    )
    expect(result.propertyId).toBe(deletedSurvey.propertyId)
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "survey_audits"'),
      expect.any(String),
      deletedSurvey.id,
      "RESTORED",
      expect.any(String),
      expect.stringContaining('"rekeyed":false'),
      user.id,
      expect.any(Date)
    )
  })

  it("re-keys to TEMP-RESTORE when active survey holds the identity", async () => {
    const { repo, tx } = makeRepo({ conflict: { id: "active-holder" } })
    const result = await repo.restore(deletedSurvey.id, user as never)

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deletedAt: null,
          propertyId: expect.stringMatching(/^TEMP-RESTORE-/),
          propertyIdOld: deletedSurvey.propertyId,
        }),
      })
    )
    expect(result.propertyId).toMatch(/^TEMP-RESTORE-/)
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "survey_audits"'),
      expect.any(String),
      deletedSurvey.id,
      "RESTORED",
      expect.any(String),
      expect.stringContaining('"rekeyed":true'),
      user.id,
      expect.any(Date)
    )
  })

  it("throws when deleted survey is not found", async () => {
    const { repo, prisma } = makeRepo({ conflict: null })
    prisma.db.survey.findFirst = jest.fn().mockResolvedValue(null as never)
    await expect(repo.restore("missing", user as never)).rejects.toBeInstanceOf(NotFoundException)
  })
})
