import { describe, expect, it, jest } from "@jest/globals"
import { NotFoundException } from "@nestjs/common"
import { SurveysRepository } from "./surveys.repository.js"

describe("SurveysRepository.transitionStatus", () => {
  function makeRepo(updatedCount: number) {
    const tx = {
      survey: {
        updateMany: jest.fn().mockResolvedValue({ count: updatedCount } as never),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "s1", surveyStatus: "REJECTED" } as never),
      },
      qcRemark: {
        createMany: jest.fn().mockResolvedValue({ count: 2 } as never),
        updateMany: jest.fn().mockResolvedValue({ count: 1 } as never),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1 as never),
    }
    const prisma = {
      db: {
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      },
    }
    return { repo: new SurveysRepository(prisma as never), tx }
  }

  it("writes QC remarks in the same transaction as the status change", async () => {
    const { repo, tx } = makeRepo(1)
    await repo.transitionStatus({
      id: "s1",
      from: "SUBMITTED",
      to: "REJECTED",
      changedBy: "qc-1",
      action: "REJECTED",
      createQcRemarks: [
        { body: "Fix owner", section: null, field: null, reason: null },
        { body: "Mobile number: Incorrect", section: "owner", field: "Mobile number", reason: "Incorrect" },
      ],
    })
    expect(tx.survey.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "s1", surveyStatus: "SUBMITTED" }) })
    )
    expect(tx.qcRemark.createMany).toHaveBeenCalledWith({
      data: [
        { surveyId: "s1", authorId: "qc-1", body: "Fix owner", section: null, field: null, reason: null },
        {
          surveyId: "s1",
          authorId: "qc-1",
          body: "Mobile number: Incorrect",
          section: "owner",
          field: "Mobile number",
          reason: "Incorrect",
        },
      ],
    })
    expect(tx.qcRemark.updateMany).not.toHaveBeenCalled()
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(1)
  })

  it("resolves open remarks when requested", async () => {
    const { repo, tx } = makeRepo(1)
    await repo.transitionStatus({
      id: "s1",
      from: "REOPENED",
      to: "SUBMITTED",
      changedBy: "surveyor-1",
      action: "SUBMITTED",
      resolveOpenQcRemarks: true,
    })
    expect(tx.qcRemark.updateMany).toHaveBeenCalledWith({
      where: { surveyId: "s1", resolvedAt: null },
      data: { resolvedAt: expect.any(Date) },
    })
    expect(tx.qcRemark.createMany).not.toHaveBeenCalled()
  })

  it("writes nothing when the conditional update loses (double submit / stale status)", async () => {
    const { repo, tx } = makeRepo(0)
    await expect(
      repo.transitionStatus({
        id: "s1",
        from: "REOPENED",
        to: "SUBMITTED",
        changedBy: "surveyor-1",
        action: "SUBMITTED",
        resolveOpenQcRemarks: true,
      })
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(tx.qcRemark.updateMany).not.toHaveBeenCalled()
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled()
  })
})
