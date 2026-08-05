import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { StatesService } from "./states.service.js"

describe("StatesService create", () => {
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ensureCreatorStateAccess = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const auditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const service = new StatesService({ create, ensureCreatorStateAccess } as never, { log: auditLog } as never)

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
    create.mockResolvedValue({ id: "s1", name: "Rajasthan", code: "RJ" })
    ensureCreatorStateAccess.mockResolvedValue(undefined)
    auditLog.mockResolvedValue(undefined)

    const result = await service.create({ name: "Rajasthan", code: "RJ" }, user)

    expect(result).toEqual({ id: "s1", name: "Rajasthan", code: "RJ" })
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
})
