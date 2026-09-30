import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { DistrictsRepository } from "./districts.repository.js"

describe("DistrictsRepository", () => {
  const district = {
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }

  const ulbCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const roleCount = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      district,
      ulb: { count: ulbCount },
      survey: { count: surveyCount },
      userTenantRole: { count: roleCount },
    },
  }
  let repo: DistrictsRepository

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

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new DistrictsRepository(prisma as never)
  })

  it("normalizes code on create", async () => {
    district.create.mockResolvedValue({ id: "d1", code: "BAG", name: "Baghpat", stateId: "s1" })
    await repo.create({ stateId: "s1", name: "Baghpat", code: "bag" })
    expect(district.create).toHaveBeenCalledWith({
      data: { stateId: "s1", name: "Baghpat", code: "BAG" },
    })
  })

  it("maps unique code conflicts to ConflictException", async () => {
    district.create.mockRejectedValue({ code: "P2002", meta: { target: ["stateId", "code"] } })
    await expect(repo.create({ stateId: "s1", name: "Baghpat", code: "BAG" })).rejects.toBeInstanceOf(ConflictException)
    await expect(repo.create({ stateId: "s1", name: "Baghpat", code: "BAG" })).rejects.toThrow(
      /District code already exists in this state/
    )
  })

  it("rejects delete while ULBs still belong to the district", async () => {
    district.findFirst.mockResolvedValueOnce({ id: "d1", name: "Baghpat", code: "BAG", stateId: "s1" })
    ulbCount.mockResolvedValueOnce(2)
    surveyCount.mockResolvedValueOnce(0)
    roleCount.mockResolvedValueOnce(0)

    await expect(repo.delete("d1", admin)).rejects.toThrow(
      "Cannot delete this district — it has 2 ULB(s). Remove them first."
    )

    expect(district.delete).not.toHaveBeenCalled()
  })

  it("deletes a district that has no ULBs, surveys, or roles", async () => {
    district.findFirst.mockResolvedValueOnce({ id: "d1", name: "Baghpat", code: "BAG", stateId: "s1" })
    ulbCount.mockResolvedValueOnce(0)
    surveyCount.mockResolvedValueOnce(0)
    roleCount.mockResolvedValueOnce(0)
    district.delete.mockResolvedValueOnce({ id: "d1" })

    await repo.delete("d1", admin)

    expect(district.delete).toHaveBeenCalledWith({ where: { id: "d1" } })
  })
})
