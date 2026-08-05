import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { StatesRepository } from "./states.repository.js"

describe("StatesRepository", () => {
  const state = {
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }
  const district = {
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }
  const survey = {
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }
  const userTenantRole = {
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }

  const prisma = { db: { state, district, survey, userTenantRole } }
  let repo: StatesRepository

  const scopedUser: AuthenticatedUser = {
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
        stateId: "existing-state",
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const globalUser: AuthenticatedUser = {
    ...scopedUser,
    tenantRoles: [
      {
        ...scopedUser.tenantRoles[0]!,
        stateId: null,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new StatesRepository(prisma as never)
  })

  it("maps unique code conflicts to ConflictException on create", async () => {
    state.create.mockRejectedValue({ code: "P2002", meta: { target: ["code"] } })
    await expect(repo.create({ name: "Rajasthan", code: "RJ" })).rejects.toBeInstanceOf(ConflictException)
    await expect(repo.create({ name: "Rajasthan", code: "RJ" })).rejects.toThrow(/already exists/)
  })

  it("maps P2002 without meta.target to ConflictException on create", async () => {
    state.create.mockRejectedValue({ code: "P2002", meta: {} })
    await expect(repo.create({ name: "Uttar Pradesh", code: "UP" })).rejects.toBeInstanceOf(ConflictException)
  })

  it("findByCode looks up by unique code", async () => {
    state.findUnique.mockResolvedValue({ id: "s1", code: "UP", name: "Uttar Pradesh" })
    await expect(repo.findByCode("UP")).resolves.toEqual({ id: "s1", code: "UP", name: "Uttar Pradesh" })
    expect(state.findUnique).toHaveBeenCalledWith({ where: { code: "UP" } })
  })

  it("assigns the new state to a non-global creator", async () => {
    userTenantRole.findFirst.mockResolvedValue(null)
    userTenantRole.create.mockResolvedValue({ id: "tr-new" })

    await repo.ensureCreatorStateAccess(scopedUser, "new-state")

    expect(userTenantRole.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        roleId: "r1",
        stateId: "new-state",
        assignedBy: "u1",
      },
    })
  })

  it("skips assignment for global creators", async () => {
    await repo.ensureCreatorStateAccess(globalUser, "new-state")
    expect(userTenantRole.findFirst).not.toHaveBeenCalled()
    expect(userTenantRole.create).not.toHaveBeenCalled()
  })

  it("skips assignment when creator already has the state", async () => {
    await repo.ensureCreatorStateAccess(scopedUser, "existing-state")
    expect(userTenantRole.findFirst).not.toHaveBeenCalled()
    expect(userTenantRole.create).not.toHaveBeenCalled()
  })

  it("blocks delete when the state still has districts", async () => {
    state.findFirst.mockResolvedValue({ id: "up-empty", code: "UP" })
    district.count.mockResolvedValue(2)
    survey.count.mockResolvedValue(0)

    await expect(repo.delete("up-empty", globalUser)).rejects.toBeInstanceOf(ConflictException)
    expect(state.delete).not.toHaveBeenCalled()
  })

  it("deletes an empty state after clearing tenant assignments", async () => {
    state.findFirst.mockResolvedValue({ id: "up-empty", code: "UP" })
    district.count.mockResolvedValue(0)
    survey.count.mockResolvedValue(0)
    userTenantRole.deleteMany.mockResolvedValue({ count: 1 })
    state.delete.mockResolvedValue({ id: "up-empty" })

    await expect(repo.delete("up-empty", globalUser)).resolves.toEqual({ id: "up-empty" })
    expect(userTenantRole.deleteMany).toHaveBeenCalledWith({ where: { stateId: "up-empty" } })
    expect(state.delete).toHaveBeenCalledWith({ where: { id: "up-empty" } })
  })
})
