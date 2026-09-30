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
  const wardCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const roleCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const apiKeyCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      district: { findFirst: districtFindFirst },
      ulb: { findFirst: ulbFindFirst, create: ulbCreate, update: ulbUpdate, delete: ulbDelete },
      ward: { count: wardCount },
      survey: { count: surveyCount },
      userTenantRole: { count: roleCount },
      ulbApiKey: { count: apiKeyCount },
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
    wardCount.mockReset()
    surveyCount.mockReset()
    roleCount.mockReset()
    apiKeyCount.mockReset()
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

  it("rejects moving a ULB to another district", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1", name: "Etah", code: "ETA" })

    await expect(repo.update("ulb-1", { districtId: "district-2", name: "Etah" }, admin)).rejects.toBeInstanceOf(
      BadRequestException
    )

    expect(ulbUpdate).not.toHaveBeenCalled()
  })

  it("rejects delete when wards still reference the ULB", async () => {
    ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
    wardCount.mockResolvedValueOnce(2)
    surveyCount.mockResolvedValueOnce(0)
    roleCount.mockResolvedValueOnce(0)
    apiKeyCount.mockResolvedValueOnce(0)

    await expect(repo.delete("ulb-1", admin)).rejects.toThrow(/2 ward/)

    expect(wardCount).toHaveBeenCalledWith({ where: { ulbId: "ulb-1" } })
    expect(ulbDelete).not.toHaveBeenCalled()
  })
})
