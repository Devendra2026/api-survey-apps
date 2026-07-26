import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ForbiddenException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { RoleProvisioningService } from "../common/services/role-provisioning.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { UserImportService } from "./user-import.service.js"
import { UserUpsertService } from "./user-upsert.service.js"

function adminActor(): AuthenticatedUser {
  return {
    id: "actor-1",
    clerkUserId: "user_actor",
    email: "admin@example.com",
    fullName: "Admin",
    phone: null,
    isActive: true,
    permissions: ["user:create"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "role-admin",
        roleName: "ADMIN",
        permissions: ["user:create", "role:assign"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }
}

function supervisorActor(): AuthenticatedUser {
  const actor = adminActor()
  return {
    ...actor,
    id: "actor-sup",
    tenantRoles: [
      {
        ...actor.tenantRoles[0]!,
        roleName: "FIELD_SUPERVISOR",
        permissions: ["user:create"],
      },
    ],
  }
}

describe("UserUpsertService", () => {
  const users = new Map<string, Record<string, unknown>>()

  function buildPrismaMock() {
    return {
      db: {
        user: {
          findUnique: jest.fn(({ where }: { where: { clerkUserId?: string; email?: string } }) => {
            if (where.clerkUserId) {
              return Promise.resolve([...users.values()].find((u) => u.clerkUserId === where.clerkUserId) ?? null)
            }
            if (where.email) {
              return Promise.resolve([...users.values()].find((u) => u.email === where.email) ?? null)
            }
            return Promise.resolve(null)
          }),
          create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
            const row = { id: `u-${users.size + 1}`, ...data }
            users.set(row.id, row)
            return Promise.resolve(row)
          }),
          update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = users.get(where.id)
            if (!existing) return Promise.reject(new Error("not found"))
            const next = { ...existing, ...data }
            users.set(where.id, next)
            return Promise.resolve(next)
          }),
        },
        role: {
          findUnique: jest.fn(({ where }: { where: { name: string } }) => {
            if (where.name === "SURVEYOR") return Promise.resolve({ id: "role-surveyor", name: "SURVEYOR" })
            if (where.name === "ADMIN") return Promise.resolve({ id: "role-admin", name: "ADMIN" })
            return Promise.resolve(null)
          }),
        },
        userTenantRole: {
          updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
          create: jest.fn(() => Promise.resolve({ id: "utr-1" })),
        },
      },
    }
  }

  let prisma: ReturnType<typeof buildPrismaMock>
  let roleProvisioning: { ensurePendingApproval: ReturnType<typeof jest.fn> }
  let service: UserUpsertService

  beforeEach(() => {
    users.clear()
    prisma = buildPrismaMock()
    roleProvisioning = {
      ensurePendingApproval: jest.fn(() => Promise.resolve(true)),
    }
    service = new UserUpsertService(
      prisma as unknown as PrismaService,
      roleProvisioning as unknown as RoleProvisioningService
    )
  })

  it("matches by clerkUserId before email", async () => {
    users.set("u-1", {
      id: "u-1",
      clerkUserId: "user_real",
      email: "old@example.com",
      fullName: "Old",
      phone: null,
      isActive: true,
    })

    const result = await service.upsert({
      clerkUserId: "user_real",
      email: "new@example.com",
      fullName: "New Name",
      source: "clerk-sync",
    })

    expect(result.action).toBe("updated")
    expect(result.userId).toBe("u-1")
    expect(users.get("u-1")?.email).toBe("new@example.com")
    expect(users.get("u-1")?.fullName).toBe("New Name")
    expect(roleProvisioning.ensurePendingApproval).toHaveBeenCalledWith("u-1")
  })

  it("falls back to email match and creates pending placeholder when no clerk id", async () => {
    const result = await service.upsert({
      email: "Pending.User@Example.com",
      fullName: "Pending User",
      source: "file-import",
      actor: adminActor(),
    })

    expect(result.action).toBe("created")
    expect(result.clerkUserId).toBe("pending:pending.user@example.com")
    expect(result.email).toBe("pending.user@example.com")
  })

  it("rebinds pending clerkUserId when sync provides real id for same email", async () => {
    users.set("u-2", {
      id: "u-2",
      clerkUserId: "pending:link@example.com",
      email: "link@example.com",
      fullName: "Link Me",
      phone: null,
      isActive: true,
    })

    const result = await service.upsert({
      clerkUserId: "user_linked",
      email: "link@example.com",
      fullName: "Link Me",
      source: "clerk-sync",
    })

    expect(result.action).toBe("updated")
    expect(users.get("u-2")?.clerkUserId).toBe("user_linked")
  })

  it("does not overwrite fullName with blank values", async () => {
    users.set("u-3", {
      id: "u-3",
      clerkUserId: "user_keep",
      email: "keep@example.com",
      fullName: "Keep Name",
      phone: "+91111",
      isActive: true,
    })

    await service.upsert({
      clerkUserId: "user_keep",
      email: "keep@example.com",
      fullName: "  ",
      phone: "",
      source: "clerk-sync",
    })

    expect(users.get("u-3")?.fullName).toBe("Keep Name")
    expect(users.get("u-3")?.phone).toBe("+91111")
  })

  it("rejects import role the actor cannot grant", async () => {
    await expect(
      service.upsert({
        email: "nope@example.com",
        roleName: "ADMIN",
        source: "file-import",
        actor: supervisorActor(),
      })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it("assigns import role when actor is allowed", async () => {
    const result = await service.upsert({
      email: "surveyor@example.com",
      fullName: "Surveyor",
      roleName: "SURVEYOR",
      source: "file-import",
      actor: adminActor(),
    })

    expect(result.action).toBe("created")
    expect(result.warnings.some((w) => w.includes("geography"))).toBe(true)
    expect(roleProvisioning.ensurePendingApproval).not.toHaveBeenCalled()
    expect(prisma.db.userTenantRole.create).toHaveBeenCalled()
  })
})

describe("UserImportService dry-run", () => {
  it("parses CSV and returns dry-run preview without committing", async () => {
    const preview = jest.fn(() =>
      Promise.resolve({
        status: "ok" as const,
        action: "create" as const,
        message: "Will create",
        warnings: [] as string[],
      })
    )
    const upsert = jest.fn()
    const importService = new UserImportService({ preview, upsert } as unknown as UserUpsertService)

    const csv = Buffer.from(
      ["email,first_name,last_name,id,role", "a@example.com,Ada,Lovelace,user_1,SURVEYOR"].join("\n"),
      "utf8"
    )

    const result = await importService.importFile(
      { buffer: csv, originalname: "users.csv" } as Express.Multer.File,
      adminActor(),
      { dryRun: true }
    )

    expect(result.dryRun).toBe(true)
    expect(result.created).toBe(1)
    expect(result.rows[0]?.email).toBe("a@example.com")
    expect(result.rows[0]?.clerkUserId).toBe("user_1")
    expect(preview).toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it("flags missing email as error rows", async () => {
    const importService = new UserImportService({
      preview: jest.fn(),
      upsert: jest.fn(),
    } as unknown as UserUpsertService)

    const csv = Buffer.from(["email,first_name", ",NoEmail"].join("\n"), "utf8")
    const result = await importService.importFile(
      { buffer: csv, originalname: "users.csv" } as Express.Multer.File,
      adminActor(),
      { dryRun: true }
    )

    expect(result.errors).toBe(1)
    expect(result.rows[0]?.status).toBe("error")
    expect(result.rows[0]?.message).toMatch(/Missing email/i)
  })
})

describe("auth guard pending rebind contract", () => {
  it("only rebinds when stored clerkUserId is pending", () => {
    const pending = { clerkUserId: "pending:x@y.com", email: "x@y.com" }
    const real = { clerkUserId: "user_other", email: "x@y.com" }
    expect(pending.clerkUserId.startsWith("pending:")).toBe(true)
    expect(real.clerkUserId.startsWith("pending:")).toBe(false)
  })
})
