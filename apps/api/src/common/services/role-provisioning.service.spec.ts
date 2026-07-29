import { describe, expect, it, jest } from "@jest/globals"
import { ConfigService } from "@nestjs/config"
import { promoteClerkUserToAdmin } from "@workspace/database"
import { RoleProvisioningService } from "./role-provisioning.service.js"

describe("promoteClerkUserToAdmin", () => {
  it("promotes an existing Clerk user to ADMIN idempotently", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 } as never)
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: "utr-admin" } as never)
    const create = jest.fn().mockResolvedValue({ id: "utr-admin" } as never)
    const transactionClient = {
      userTenantRole: { updateMany, findFirst, create },
    }
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1" } as never),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: "role-admin" } as never),
      },
      $transaction: jest.fn(async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
        operation(transactionClient)
      ),
    }

    await expect(promoteClerkUserToAdmin(prisma as never, "user_clerk_admin")).resolves.toEqual({
      status: "promoted",
      userId: "user-1",
      adminAssignmentId: "utr-admin",
    })
    await expect(promoteClerkUserToAdmin(prisma as never, "user_clerk_admin")).resolves.toEqual({
      status: "already-admin",
      userId: "user-1",
      adminAssignmentId: "utr-admin",
    })

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isActive: true,
        roleId: { not: "role-admin" },
      },
      data: {
        isActive: false,
        deactivatedBy: "user-1",
        deactivatedAt: expect.any(Date),
      },
    })
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe("RoleProvisioningService", () => {
  const userId = "user-1"
  const clerkUserId = "user_clerk_admin"

  function createService(opts: {
    bootstrapIds?: string
    roles?: Record<string, { id: string }>
    existing?: Array<{ id: string; role: { name: string } }>
  }) {
    const existingAdmin = opts.existing?.find((row) => row.role.name === "ADMIN")
    const userTenantRole = {
      findFirst: jest.fn().mockResolvedValue((existingAdmin ? { id: existingAdmin.id } : null) as never),
      create: jest.fn().mockResolvedValue({ id: "utr-new" } as never),
      updateMany: jest.fn().mockResolvedValue({ count: opts.existing?.length ?? 0 } as never),
    }
    const role = {
      findUnique: jest.fn(({ where }: { where: { name: string } }) =>
        Promise.resolve(opts.roles?.[where.name] ?? null)
      ),
    }
    const db = {
      userTenantRole,
      role,
      $transaction: jest.fn(async (operation: (tx: { userTenantRole: typeof userTenantRole }) => Promise<unknown>) =>
        operation({ userTenantRole })
      ),
    }
    const prisma = {
      db,
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
    expect(userTenantRole.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        isActive: true,
        roleId: { not: "role-admin" },
      },
      data: {
        isActive: false,
        deactivatedBy: userId,
        deactivatedAt: expect.any(Date),
      },
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
    expect(userTenantRole.updateMany).toHaveBeenCalled()
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
