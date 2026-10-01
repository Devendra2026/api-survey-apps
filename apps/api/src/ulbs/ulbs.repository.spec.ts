import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { UlbType } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { UlbsRepository } from "./ulbs.repository.js"

describe("UlbsRepository district scope and duplicates", () => {
  const districtFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ulbFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ulbCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ulbUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ulbDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyUpdateMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyAuditDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const roleDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const apiKeyDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      district: { findFirst: districtFindFirst },
      ulb: { findFirst: ulbFindFirst, create: ulbCreate, update: ulbUpdate, delete: ulbDelete },
      ward: { findMany: wardFindMany, deleteMany: wardDeleteMany },
      survey: {
        count: surveyCount,
        findMany: surveyFindMany,
        updateMany: surveyUpdateMany,
        deleteMany: surveyDeleteMany,
      },
      userTenantRole: { deleteMany: roleDeleteMany },
      ulbApiKey: { deleteMany: apiKeyDeleteMany },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ward: { findMany: wardFindMany, deleteMany: wardDeleteMany },
          survey: {
            count: surveyCount,
            findMany: surveyFindMany,
            updateMany: surveyUpdateMany,
            deleteMany: surveyDeleteMany,
          },
          surveyAudit: { deleteMany: surveyAuditDeleteMany },
          ulb: { delete: ulbDelete },
          userTenantRole: { deleteMany: roleDeleteMany },
          ulbApiKey: { deleteMany: apiKeyDeleteMany },
        })
      ),
    },
  }

  const admin: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "admin@test.com",
    fullName: "Admin",
    phone: null,
    isActive: true,
    permissions: ["settings:manage"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "ADMIN",
        permissions: ["settings:manage"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const districtUser: AuthenticatedUser = {
    ...admin,
    tenantRoles: [
      {
        id: "tr2",
        roleId: "r1",
        roleName: "ADMIN",
        permissions: ["settings:manage"],
        stateId: "state-1",
        districtId: "district-1",
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  let repo: UlbsRepository

  beforeEach(() => {
    districtFindFirst.mockReset()
    ulbFindFirst.mockReset()
    ulbCreate.mockReset()
    ulbUpdate.mockReset()
    ulbDelete.mockReset()
    wardFindMany.mockReset()
    wardDeleteMany.mockReset()
    surveyCount.mockReset()
    surveyFindMany.mockReset()
    surveyFindMany.mockResolvedValue([])
    surveyUpdateMany.mockReset()
    surveyUpdateMany.mockResolvedValue({ count: 0 })
    surveyDeleteMany.mockReset()
    surveyDeleteMany.mockResolvedValue({ count: 0 })
    surveyAuditDeleteMany.mockReset()
    surveyAuditDeleteMany.mockResolvedValue({ count: 0 })
    roleDeleteMany.mockReset()
    apiKeyDeleteMany.mockReset()
    repo = new UlbsRepository(prisma as never)
  })

  it("rejects create when the district is missing or outside scope", async () => {
    districtFindFirst.mockResolvedValueOnce(null)

    await expect(
      repo.create(
        { districtId: "district-other", name: "Nagar Palika", code: "NGR", type: UlbType.MUNICIPAL_COUNCIL },
        districtUser
      )
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(ulbCreate).not.toHaveBeenCalled()
    expect(districtFindFirst).toHaveBeenCalledWith({
      where: {
        id: "district-other",
        OR: [{ id: { in: ["district-1"] } }],
      },
      select: { id: true, stateId: true, state: { select: { id: true } } },
    })
  })

  it("rejects create when another ULB in the district has the same name", async () => {
    districtFindFirst.mockResolvedValueOnce({ id: "district-1", stateId: "state-1", state: { id: "state-1" } })
    ulbFindFirst.mockResolvedValueOnce({ id: "existing" })

    await expect(
      repo.create({ districtId: "district-1", name: " etah ", code: "ETA", type: UlbType.MUNICIPAL_COUNCIL }, admin)
    ).rejects.toThrow("A ULB with this name already exists in this district.")

    expect(ulbCreate).not.toHaveBeenCalled()
    expect(ulbFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          districtId: "district-1",
          name: { equals: "etah", mode: "insensitive" },
        }),
      })
    )
  })

  it("rejects create when another ULB already uses the code", async () => {
    districtFindFirst.mockResolvedValueOnce({ id: "district-1", stateId: "state-1", state: { id: "state-1" } })
    ulbFindFirst.mockResolvedValueOnce(null)
    ulbFindFirst.mockResolvedValueOnce({ id: "existing" })

    await expect(
      repo.create(
        { districtId: "district-1", name: "Nagar Palika", code: " eta ", type: UlbType.MUNICIPAL_COUNCIL },
        admin
      )
    ).rejects.toThrow("A ULB with this code already exists.")

    expect(ulbCreate).not.toHaveBeenCalled()
    expect(ulbFindFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          code: { equals: "eta", mode: "insensitive" },
        }),
      })
    )
  })

  it("rejects moving a ULB to another district", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1", name: "Etah", code: "ETA" })

    await expect(repo.update("ulb-1", { districtId: "district-2", name: "Etah" }, admin)).rejects.toBeInstanceOf(
      BadRequestException
    )

    expect(ulbUpdate).not.toHaveBeenCalled()
  })

  it("rejects delete when geographic wards still reference the ULB", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "w1", kind: "GEOGRAPHIC", deletedAt: null },
      { id: "w2", kind: "GEOGRAPHIC", deletedAt: null },
    ])

    await expect(repo.delete("ulb-1", admin)).rejects.toThrow(/2 ward/)

    expect(wardFindMany).toHaveBeenCalledWith({
      where: { ulbId: "ulb-1" },
      select: { id: true, kind: true, wardName: true, deletedAt: true },
    })
    expect(ulbDelete).not.toHaveBeenCalled()
    expect(wardDeleteMany).not.toHaveBeenCalled()
  })

  it("deletes an ULB whose only ward is the system Zero Ward", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([{ id: "zero-1", kind: "ZERO", wardName: "Zero Ward", deletedAt: null }])
    surveyCount.mockResolvedValue(0)
    apiKeyDeleteMany.mockResolvedValue({ count: 0 })
    roleDeleteMany.mockResolvedValue({ count: 0 })
    wardDeleteMany.mockResolvedValue({ count: 1 })
    ulbDelete.mockResolvedValue({ id: "ulb-1" })

    await repo.delete("ulb-1", admin)

    expect(apiKeyDeleteMany).toHaveBeenCalledWith({ where: { ulbId: "ulb-1" } })
    expect(roleDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ ulbId: "ulb-1" }, { wardId: { in: ["zero-1"] } }] },
    })
    expect(wardDeleteMany).toHaveBeenCalledWith({ where: { ulbId: "ulb-1", id: { in: ["zero-1"] } } })
    expect(ulbDelete).toHaveBeenCalledWith({ where: { id: "ulb-1" } })
  })

  it("deletes an ULB whose only ward is named Zero Ward even when kind is geographic", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([{ id: "zero-1", kind: "GEOGRAPHIC", wardName: "Zero Ward", deletedAt: null }])
    surveyCount.mockResolvedValue(0)
    apiKeyDeleteMany.mockResolvedValue({ count: 1 })
    roleDeleteMany.mockResolvedValue({ count: 1 })
    wardDeleteMany.mockResolvedValue({ count: 1 })
    ulbDelete.mockResolvedValue({ id: "ulb-1" })

    await repo.delete("ulb-1", admin)

    expect(ulbDelete).toHaveBeenCalledWith({ where: { id: "ulb-1" } })
  })

  it("rejects delete when a real ward exists beside the Zero Ward and deletes nothing", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "zero-1", kind: "ZERO", wardName: "Zero Ward", deletedAt: null },
      { id: "w-real", kind: "GEOGRAPHIC", wardName: "Zero Ward East", deletedAt: null },
    ])

    await expect(repo.delete("ulb-1", admin)).rejects.toThrow(/1 ward/)

    expect(ulbDelete).not.toHaveBeenCalled()
    expect(wardDeleteMany).not.toHaveBeenCalled()
    expect(surveyCount).not.toHaveBeenCalled()
  })

  it("deletes Zero Ward surveys with the ULB after the Zero Ward was removed", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "zero-1", kind: "ZERO", wardName: "Zero Ward", deletedAt: new Date("2026-10-01T00:00:00.000Z") },
    ])
    surveyCount.mockResolvedValueOnce(0)
    surveyFindMany.mockResolvedValueOnce([{ id: "survey-q" }])
    apiKeyDeleteMany.mockResolvedValue({ count: 0 })
    roleDeleteMany.mockResolvedValue({ count: 0 })
    wardDeleteMany.mockResolvedValue({ count: 1 })
    ulbDelete.mockResolvedValue({ id: "ulb-1" })

    await repo.delete("ulb-1", admin)

    expect(surveyAuditDeleteMany).toHaveBeenCalledWith({ where: { surveyId: { in: ["survey-q"] } } })
    expect(surveyDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["survey-q"] } } })
    expect(ulbDelete).toHaveBeenCalledWith({ where: { id: "ulb-1" } })
  })

  it("deletes surveys left on a removed ward when no active geographic ward remains", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "w-soft", kind: "GEOGRAPHIC", wardName: "Ward 1", deletedAt: new Date("2026-01-01T00:00:00.000Z") },
    ])
    surveyCount.mockResolvedValueOnce(0)
    surveyFindMany.mockResolvedValueOnce([{ id: "survey-left" }])
    apiKeyDeleteMany.mockResolvedValue({ count: 0 })
    roleDeleteMany.mockResolvedValue({ count: 0 })
    wardDeleteMany.mockResolvedValue({ count: 1 })
    ulbDelete.mockResolvedValue({ id: "ulb-1" })

    await repo.delete("ulb-1", admin)

    expect(surveyDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["survey-left"] } } })
    expect(wardDeleteMany).toHaveBeenCalledWith({ where: { ulbId: "ulb-1", id: { in: ["w-soft"] } } })
    expect(ulbDelete).toHaveBeenCalledWith({ where: { id: "ulb-1" } })
  })

  it("rejects delete when an active survey is still on an active geographic ward", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "zero-1", kind: "ZERO", wardName: "Zero Ward", deletedAt: new Date("2026-10-01T00:00:00.000Z") },
    ])
    surveyCount.mockResolvedValueOnce(1)

    await expect(repo.delete("ulb-1", admin)).rejects.toThrow("Cannot delete this ULB — surveys are linked to it.")

    expect(ulbDelete).not.toHaveBeenCalled()
    expect(surveyDeleteMany).not.toHaveBeenCalled()
    expect(wardDeleteMany).not.toHaveBeenCalled()
  })

  it("rejects delete when the only ward is a geographic ward numbered 0", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "w-00", kind: "GEOGRAPHIC", wardNumber: "0", wardName: "0", deletedAt: null },
    ])

    await expect(repo.delete("ulb-1", admin)).rejects.toThrow(/1 ward/)

    expect(ulbDelete).not.toHaveBeenCalled()
    expect(wardDeleteMany).not.toHaveBeenCalled()
    expect(surveyCount).not.toHaveBeenCalled()
  })

  it("deletes a soft-deleted user ward tombstone together with the system Zero Ward", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardFindMany.mockResolvedValueOnce([
      { id: "zero-1", kind: "ZERO", wardName: "Zero Ward", deletedAt: null },
      { id: "w-soft", kind: "GEOGRAPHIC", wardName: "Ward 1", deletedAt: new Date("2026-01-01T00:00:00.000Z") },
    ])
    surveyCount.mockResolvedValue(0)
    apiKeyDeleteMany.mockResolvedValue({ count: 0 })
    roleDeleteMany.mockResolvedValue({ count: 0 })
    wardDeleteMany.mockResolvedValue({ count: 2 })
    ulbDelete.mockResolvedValue({ id: "ulb-1" })

    await repo.delete("ulb-1", admin)

    expect(wardDeleteMany).toHaveBeenCalledWith({ where: { ulbId: "ulb-1", id: { in: ["zero-1", "w-soft"] } } })
    expect(ulbDelete).toHaveBeenCalledWith({ where: { id: "ulb-1" } })
  })
})
