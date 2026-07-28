import { describe, expect, it, jest } from "@jest/globals"
import { ConfigService } from "@nestjs/config"
import { RoleProvisioningService } from "./role-provisioning.service.js"

describe("RoleProvisioningService", () => {
  const userId = "user-1"
  const clerkUserId = "user_clerk_admin"

  function createService(opts: {
    bootstrapIds?: string
    roles?: Record<string, { id: string }>
    existing?: Array<{ id: string; role: { name: string } }>
  }) {
    const userTenantRole = {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue((opts.existing ?? []) as never),
      create: jest.fn().mockResolvedValue({ id: "utr-new" } as never),
      update: jest.fn().mockResolvedValue({} as never),
    }
    const role = {
      findUnique: jest.fn(({ where }: { where: { name: string } }) =>
        Promise.resolve(opts.roles?.[where.name] ?? null)
      ),
    }
    const prisma = {
      db: { userTenantRole, role },
    }
    const configService = {
      get: jest.fn((key: string) => (key === "BOOTSTRAP_ADMIN_CLERK_USER_IDS" ? (opts.bootstrapIds ?? "") : undefined)),
    } as unknown as ConfigService

    const service = new RoleProvisioningService(prisma as never, configService)
    return { service, userTenantRole, role }
  }

  it("returns false when clerk id is not in bootstrap list", async () => {
    const { service, userTenantRole } = createService({ bootstrapIds: "user_other" })
    await expect(service.ensureBootstrapAdmin(userId, clerkUserId)).resolves.toBe(false)
    expect(userTenantRole.create).not.toHaveBeenCalled()
  })

  it("creates ADMIN when bootstrap user has no roles", async () => {
    const { service, userTenantRole } = createService({
      bootstrapIds: clerkUserId,
      roles: { ADMIN: { id: "role-admin" } },
      existing: [],
    })
    await expect(service.ensureBootstrapAdmin(userId, clerkUserId)).resolves.toBe(true)
    expect(userTenantRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId, roleId: "role-admin", isActive: true }),
      })
    )
  })

  it("promotes PENDING_APPROVAL to ADMIN for bootstrap users", async () => {
    const { service, userTenantRole } = createService({
      bootstrapIds: clerkUserId,
      roles: { ADMIN: { id: "role-admin" } },
      existing: [{ id: "utr-pending", role: { name: "PENDING_APPROVAL" } }],
    })
    await expect(service.ensureBootstrapAdmin(userId, clerkUserId)).resolves.toBe(true)
    expect(userTenantRole.update).toHaveBeenCalledWith({
      where: { id: "utr-pending" },
      data: { isActive: false },
    })
    expect(userTenantRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: "role-admin" }),
      })
    )
  })

  it("returns true without changes when already ADMIN", async () => {
    const { service, userTenantRole } = createService({
      bootstrapIds: clerkUserId,
      roles: { ADMIN: { id: "role-admin" } },
      existing: [{ id: "utr-admin", role: { name: "ADMIN" } }],
    })
    await expect(service.ensureBootstrapAdmin(userId, clerkUserId)).resolves.toBe(true)
    expect(userTenantRole.update).not.toHaveBeenCalled()
    expect(userTenantRole.create).not.toHaveBeenCalled()
  })

  it("returns false when ADMIN role is missing", async () => {
    const { service, userTenantRole } = createService({
      bootstrapIds: clerkUserId,
      roles: {},
      existing: [],
    })
    await expect(service.ensureBootstrapAdmin(userId, clerkUserId)).resolves.toBe(false)
    expect(userTenantRole.create).not.toHaveBeenCalled()
  })
})
