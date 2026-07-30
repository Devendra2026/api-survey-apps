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
    findMany = jest.fn()
    const prisma = {
      db: {
        survey: { findFirst, findMany },
      },
    }
    repo = new QcRepository(prisma as never)
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
    findMany.mockResolvedValue(queue as never)

    await expect(repo.findQueueNeighbors(user, wardId, "s2")).resolves.toEqual({
      prevId: "s1",
      nextId: "s3",
      parcelNumber: "00002",
    })
  })

  it("returns next after approve when current is no longer pending", async () => {
    findFirst.mockResolvedValue({ id: "s2", parcelNumber: "00002", wardId } as never)
    findMany.mockResolvedValue([queue[0], queue[2]] as never)

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
})
