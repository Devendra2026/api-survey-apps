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
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }
  const userTenantRole = {
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }

  const prisma = { db: { state, userTenantRole } }
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
    await expect(repo.create({ name: "Rajasthan", code: "RJ" })).rejects.toThrow(/State code already exists/)
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
})
