import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository.quarantineToZeroWard", () => {
  const existing = {
    id: "survey-b",
    deletedAt: null,
    surveyStatus: "SUBMITTED",
    qcStatus: "PENDING",
    ulbId: "ulb-1",
    wardId: "ward-1",
    originalWardId: null,
    propertyId: "800726-001-00269-001-R",
    parcelNumber: "00269",
    unitSubNo: "001",
    wardNumber: "1",
    ward: { id: "ward-1", kind: "GEOGRAPHIC", wardNumber: "1" },
    originalWard: null,
  }

  function makeRepo(surveyOverrides: Record<string, unknown> = {}) {
    const survey = { ...existing, ...surveyOverrides }
    const updated = {
      ...survey,
      wardId: "zero-1",
      originalWardId: "ward-1",
      propertyId: survey.propertyId,
      parcelNumber: survey.parcelNumber,
      wardNumber: survey.wardNumber,
    }
    const tx = {
      survey: {
        update: jest.fn().mockResolvedValue(updated as never),
        findFirstOrThrow: jest.fn().mockResolvedValue(updated as never),
      },
      surveyAudit: { create: jest.fn().mockResolvedValue({} as never) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1 as never),
    }
    const prisma = {
      db: {
        survey: { findFirst: jest.fn().mockResolvedValue(survey as never) },
        ward: {
          findFirst: jest.fn().mockResolvedValue({
            id: "zero-1",
            ulbId: "ulb-1",
            wardNumber: "0",
            wardName: "Zero Ward",
            kind: "ZERO",
          } as never),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      },
    }
    const repo = new QcRepository(
      prisma as never,
      { listScopedWards: jest.fn() } as never,
      {
        ensureFormulaPropertyId: jest.fn(),
      } as never
    )
    return { repo, tx, survey }
  }

  it("moves a duplicate to Zero Ward and keeps the original ward and Property ID", async () => {
    const { repo, tx, survey } = makeRepo()
    await repo.quarantineToZeroWard("survey-b", "user-1")
    expect(tx.survey.update).toHaveBeenCalledWith({
      where: { id: "survey-b" },
      data: {
        ward: { connect: { id: "zero-1" } },
        originalWard: { connect: { id: "ward-1" } },
      },
    })
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("survey_audits"),
      expect.any(String),
      "survey-b",
      "qc.quarantined",
      expect.any(String),
      expect.stringContaining("duplicate/quarantine"),
      "user-1",
      expect.any(Date)
    )
    expect(survey.propertyId).toBe("800726-001-00269-001-R")
  })

  it("refuses to move an approved survey", async () => {
    const { repo, tx } = makeRepo({ surveyStatus: "APPROVED" })
    await expect(repo.quarantineToZeroWard("survey-b", "user-1")).rejects.toThrow(BadRequestException)
    expect(tx.survey.update).not.toHaveBeenCalled()
  })

  it("keeps Ward 1 and Ward 2 originals separate when both are already quarantined", async () => {
    const { repo } = makeRepo({
      wardId: "zero-1",
      originalWardId: "ward-2",
      ward: { id: "zero-1", kind: "ZERO", wardNumber: "0" },
      originalWard: { id: "ward-2" },
      wardNumber: "2",
      propertyId: "800726-002-00269-001-R",
    })
    await expect(repo.quarantineToZeroWard("survey-b", "user-1")).rejects.toThrow(/already quarantined/)
  })
})
