import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository queue first/neighbors", () => {
  const user: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "qc@test.com",
    fullName: "QC",
    phone: null,
    isActive: true,
    permissions: ["survey:approve"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "QC_SUPERVISOR",
        permissions: ["survey:approve"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const wardId = "ward-1"
  const queue = [
    { id: "s1", parcelNumber: "00001" },
    { id: "s2", parcelNumber: "00002" },
    { id: "s3", parcelNumber: "00003" },
  ]

  let findFirst: jest.Mock
  let findMany: jest.Mock
  let repo: QcRepository

  beforeEach(() => {
    findFirst = jest.fn()
    findMany = jest.fn().mockResolvedValue([] as never)
    const prisma = {
      db: {
        survey: { findFirst, findMany },
        ward: {
          findUnique: jest.fn().mockResolvedValue({
            id: wardId,
            ulbId: "ulb-1",
            wardNumber: "1",
          } as never),
          findMany: jest.fn().mockResolvedValue([] as never),
        },
      },
    }
    const wardCatalog = { listScopedWards: jest.fn<() => Promise<unknown[]>>(() => Promise.resolve([])) }
    const surveysService = {
      ensureFormulaPropertyId: jest.fn(<T>(survey: T) => Promise.resolve(survey)),
    }
    repo = new QcRepository(prisma as never, wardCatalog as never, surveysService as never)
  })

  it("returns first pending parcel ordered by parcelNumber ASC", async () => {
    findFirst.mockResolvedValue(queue[0] as never)
    await expect(repo.findQueueFirst(user, wardId)).resolves.toEqual(queue[0])
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wardId,
          surveyStatus: "SUBMITTED",
          qcStatus: "PENDING",
        }),
        orderBy: [{ parcelNumber: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      })
    )
  })

  it("returns neighbors for survey in pending queue", async () => {
    findFirst.mockResolvedValue({ id: "s2", parcelNumber: "00002", wardId } as never)
    findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce(queue as never)

    await expect(repo.findQueueNeighbors(user, wardId, "s2")).resolves.toEqual({
      prevId: "s1",
      nextId: "s3",
      parcelNumber: "00002",
    })
  })

  it("returns next after approve when current is no longer pending", async () => {
    findFirst.mockResolvedValue({ id: "s2", parcelNumber: "00002", wardId } as never)
    findMany.mockResolvedValueOnce([] as never).mockResolvedValueOnce([queue[0], queue[2]] as never)

    await expect(repo.findQueueNeighbors(user, wardId, "s2")).resolves.toEqual({
      prevId: "s1",
      nextId: "s3",
      parcelNumber: "00002",
    })
  })

  it("rejects survey outside active ward", async () => {
    findFirst.mockResolvedValue({ id: "s2", parcelNumber: "00002", wardId: "other" } as never)
    await expect(repo.findQueueNeighbors(user, wardId, "s2")).rejects.toThrow(BadRequestException)
  })

  it("throws when survey missing", async () => {
    findFirst.mockResolvedValue(null as never)
    await expect(repo.findQueueNeighbors(user, wardId, "missing")).rejects.toThrow(NotFoundException)
  })

  it("finds pending parcel by parcel number with zero-pad variants", async () => {
    findFirst.mockResolvedValue(queue[1] as never)
    await expect(repo.findQueueByParcel(user, wardId, "2")).resolves.toEqual(queue[1])
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              wardId,
              surveyStatus: "SUBMITTED",
              qcStatus: "PENDING",
            }),
            {
              OR: [{ parcelNumber: { in: expect.arrayContaining(["2", "00002"]) } }, { parcelNumber: "2" }],
            },
          ],
        },
      })
    )
  })

  it("finds pending parcel with PENDING qcStatus", async () => {
    findFirst.mockResolvedValue(queue[2] as never)
    await expect(repo.findQueueByParcel(user, wardId, "00003")).resolves.toEqual(queue[2])
    const call = findFirst.mock.calls[0]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    expect(call.where.AND[0]).toEqual(
      expect.objectContaining({
        surveyStatus: "SUBMITTED",
        qcStatus: "PENDING",
      })
    )
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it("prefers a pending survey over a non-pending match in the same ward", async () => {
    findFirst.mockResolvedValueOnce(queue[1] as never)
    await expect(repo.findQueueByParcel(user, wardId, "00269")).resolves.toEqual(queue[1])
    expect(findFirst).toHaveBeenCalledTimes(1)
    const call = findFirst.mock.calls[0]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    expect(call.where.AND[0]).toEqual(
      expect.objectContaining({
        wardId,
        surveyStatus: "SUBMITTED",
        qcStatus: "PENDING",
      })
    )
  })

  it("returns an approved survey in the active ward when none are pending", async () => {
    const approved = { id: "s-approved", parcelNumber: "00269" }
    findFirst.mockResolvedValueOnce(null as never).mockResolvedValueOnce(approved as never)

    await expect(repo.findQueueByParcel(user, wardId, "269")).resolves.toEqual(approved)

    expect(findFirst).toHaveBeenCalledTimes(2)
    const pendingCall = findFirst.mock.calls[0]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    const censusCall = findFirst.mock.calls[1]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    expect(pendingCall.where.AND[0]).toEqual(
      expect.objectContaining({ wardId, surveyStatus: "SUBMITTED", qcStatus: "PENDING" })
    )
    expect(censusCall.where.AND[0]).toEqual(
      expect.objectContaining({
        deletedAt: null,
        wardId,
      })
    )
    expect(censusCall.where.AND[0]).not.toEqual(expect.objectContaining({ qcStatus: "PENDING" }))
    expect(censusCall.where.AND[1]).toEqual(
      expect.objectContaining({
        OR: [{ parcelNumber: { in: expect.arrayContaining(["269", "00269"]) } }, { parcelNumber: "269" }],
      })
    )
  })

  it("returns null when the parcel does not exist in the active ward", async () => {
    findFirst.mockResolvedValue(null as never)
    await expect(repo.findQueueByParcel(user, "ward-7", "00269")).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledTimes(2)
    for (const call of findFirst.mock.calls) {
      const where = (call[0] as { where: { AND: Array<Record<string, unknown>> } }).where
      expect(where.AND[0]).toEqual(expect.objectContaining({ wardId: "ward-7" }))
    }
  })
})
