import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { StatesService } from "./states.service.js"

describe("StatesService create", () => {
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const findByCode = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ensureCreatorStateAccess = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const auditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const service = new StatesService(
    { create, findByCode, ensureCreatorStateAccess } as never,
    { log: auditLog } as never
  )

  const user: AuthenticatedUser = {
    id: "u1",
    clerkUserId: "c1",
    email: "admin@test.com",
    fullName: "Admin",
    phone: null,
    isActive: true,
    permissions: ["settings:manage"],
    tenantRoles: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates state, grants creator access, then audits", async () => {
    findByCode.mockResolvedValue(null)
    create.mockResolvedValue({ id: "s1", name: "Rajasthan", code: "RJ" })
    ensureCreatorStateAccess.mockResolvedValue(undefined)
    auditLog.mockResolvedValue(undefined)

    const result = await service.create({ name: "Rajasthan", code: "RJ" }, user)

    expect(result).toEqual({ id: "s1", name: "Rajasthan", code: "RJ" })
    expect(findByCode).toHaveBeenCalledWith("RJ")
    expect(create).toHaveBeenCalledWith({ name: "Rajasthan", code: "RJ" })
    expect(ensureCreatorStateAccess).toHaveBeenCalledWith(user, "s1")
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "state",
        entityId: "s1",
        action: "CREATE",
        actorId: "u1",
      })
    )
  })

  it("rejects duplicate code and grants access to the existing state", async () => {
    findByCode.mockResolvedValue({ id: "up1", name: "Uttar Pradesh", code: "UP" })
    ensureCreatorStateAccess.mockResolvedValue(undefined)

    await expect(service.create({ name: "Uttar Pradesh", code: "UP" }, user)).rejects.toBeInstanceOf(ConflictException)
    await expect(service.create({ name: "Uttar Pradesh", code: "UP" }, user)).rejects.toThrow(/already exists/)
    expect(ensureCreatorStateAccess).toHaveBeenCalledWith(user, "up1")
    expect(create).not.toHaveBeenCalled()
  })
})
