import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import type { Reflector } from "@nestjs/core"
import type { PrismaService } from "../../prisma/prisma.service.js"
import type { RoleProvisioningService } from "../services/role-provisioning.service.js"
import type { TenantScopeService } from "../services/tenant-scope.service.js"
import { ClerkAuthGuard } from "./clerk-auth.guard.js"

describe("ClerkAuthGuard.resolveLocalUser", () => {
  const findUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const userCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const userUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const ensureBootstrapAdmin = jest.fn<(...args: unknown[]) => Promise<boolean>>()
  const ensurePendingApproval = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const loadUserContext = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  let guard: ClerkAuthGuard
  let resolveLocalUser: (input: {
    clerkUserId: string
    email: string
    fullName: string
    phone: string | null
    profileFetched: boolean
    emailVerified?: boolean
  }) => Promise<unknown>

  beforeEach(() => {
    jest.clearAllMocks()
    const prisma = {
      db: {
        user: { findUnique, create: userCreate, update: userUpdate },
      },
    } as unknown as PrismaService
    const roleProvisioning = {
      ensureBootstrapAdmin,
      ensurePendingApproval,
    } as unknown as RoleProvisioningService
    const tenantScopeService = { loadUserContext } as unknown as TenantScopeService
    guard = new ClerkAuthGuard(
      {} as Reflector,
      { get: () => undefined } as unknown as ConfigService,
      prisma,
      tenantScopeService,
      roleProvisioning
    )
    resolveLocalUser = (
      guard as unknown as {
        resolveLocalUser: typeof resolveLocalUser
      }
    ).resolveLocalUser.bind(guard)

    ensureBootstrapAdmin.mockResolvedValue(false)
    ensurePendingApproval.mockResolvedValue(undefined)
    loadUserContext.mockResolvedValue({ permissions: ["survey:view"], tenantRoles: [] })
  })

  it("refuses JIT create when Clerk profile was not fetched", async () => {
    findUnique.mockResolvedValue(null)

    await expect(
      resolveLocalUser({
        clerkUserId: "user_new",
        email: "",
        fullName: "User",
        phone: null,
        profileFetched: false,
      })
    ).rejects.toThrow(UnauthorizedException)

    expect(userCreate).not.toHaveBeenCalled()
  })

  it("does not resurrect an inactive user matched by email", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      clerkUserId: "user_old",
      isActive: false,
      fullName: "Ada",
      phone: null,
    })

    await expect(
      resolveLocalUser({
        clerkUserId: "user_new",
        email: "a@example.com",
        fullName: "Ada",
        phone: null,
        profileFetched: true,
      })
    ).rejects.toThrow(/disabled/i)

    expect(userCreate).not.toHaveBeenCalled()
  })

  it("loads application user A by clerkUserId for Clerk user A", async () => {
    findUnique.mockResolvedValueOnce({
      id: "uuid-a",
      clerkUserId: "user_a",
      email: "a@example.com",
      fullName: "Surveyor A",
      phone: null,
      isActive: true,
    })
    userUpdate.mockResolvedValue({
      id: "uuid-a",
      clerkUserId: "user_a",
      email: "a@example.com",
      fullName: "Surveyor A",
      phone: null,
      isActive: true,
    })

    const result = await resolveLocalUser({
      clerkUserId: "user_a",
      email: "a@example.com",
      fullName: "Surveyor A",
      phone: null,
      profileFetched: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: "uuid-a",
        clerkUserId: "user_a",
      })
    )
    // Internal Prisma id is not compared to Clerk userId.
    expect((result as { id: string }).id).not.toBe("user_a")
    expect(userCreate).not.toHaveBeenCalled()
  })

  it("loads application user B by clerkUserId and does not return user A", async () => {
    findUnique.mockResolvedValueOnce({
      id: "uuid-b",
      clerkUserId: "user_b",
      email: "b@example.com",
      fullName: "Surveyor B",
      phone: null,
      isActive: true,
    })
    userUpdate.mockResolvedValue({
      id: "uuid-b",
      clerkUserId: "user_b",
      email: "b@example.com",
      fullName: "Surveyor B",
      phone: null,
      isActive: true,
    })

    const result = await resolveLocalUser({
      clerkUserId: "user_b",
      email: "b@example.com",
      fullName: "Surveyor B",
      phone: null,
      profileFetched: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: "uuid-b",
        clerkUserId: "user_b",
      })
    )
    expect((result as { clerkUserId: string }).clerkUserId).not.toBe("user_a")
  })

  it("refuses email adoption when email is not verified on the Clerk session", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "uuid-a",
      email: "shared@example.com",
      clerkUserId: "user_a",
      isActive: true,
      fullName: "Surveyor A",
      phone: null,
    })

    await expect(
      resolveLocalUser({
        clerkUserId: "user_b",
        email: "shared@example.com",
        fullName: "Surveyor B",
        phone: null,
        profileFetched: true,
        emailVerified: false,
      })
    ).rejects.toThrow(/already linked to a different Clerk account/i)

    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("rebinds verified-email identity to authenticated clerkUserId without creating a duplicate user", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "uuid-a",
      email: "shared@example.com",
      clerkUserId: "user_a",
      isActive: true,
      fullName: "Surveyor A",
      phone: null,
    })
    userUpdate
      .mockResolvedValueOnce({
        id: "uuid-a",
        email: "shared@example.com",
        clerkUserId: "user_b",
        isActive: true,
        fullName: "Surveyor A",
        phone: null,
      })
      .mockResolvedValueOnce({
        id: "uuid-a",
        email: "shared@example.com",
        clerkUserId: "user_b",
        isActive: true,
        fullName: "Surveyor A",
        phone: null,
      })

    const result = await resolveLocalUser({
      clerkUserId: "user_b",
      email: "shared@example.com",
      fullName: "Surveyor A",
      phone: null,
      profileFetched: true,
      emailVerified: true,
    })

    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        id: "uuid-a",
        clerkUserId: "user_b",
        email: "shared@example.com",
      })
    )
  })

  it("refuses unverified email adoption even for a different real clerkUserId and never creates a duplicate", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "uuid-a",
      email: "google@example.com",
      clerkUserId: "user_password",
      isActive: true,
      fullName: "Surveyor A",
      phone: null,
    })

    await expect(
      resolveLocalUser({
        clerkUserId: "user_google",
        email: "google@example.com",
        fullName: "Surveyor A",
        phone: null,
        profileFetched: true,
        emailVerified: false,
        verificationDetail: "emailStatus=unverified emailStrategy=oauth_google providers=oauth_google via=none",
      })
    ).rejects.toThrow(/already linked to a different Clerk account/i)

    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("rebinds pending: email placeholder so returned clerkUserId equals verified subject", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "uuid-pending",
      email: "pending@example.com",
      clerkUserId: "pending:pending@example.com",
      isActive: true,
      fullName: "Pending Surveyor",
      phone: null,
    })
    userUpdate
      .mockResolvedValueOnce({
        id: "uuid-pending",
        email: "pending@example.com",
        clerkUserId: "user_new",
        isActive: true,
        fullName: "Pending Surveyor",
        phone: null,
      })
      .mockResolvedValueOnce({
        id: "uuid-pending",
        email: "pending@example.com",
        clerkUserId: "user_new",
        isActive: true,
        fullName: "Pending Surveyor",
        phone: null,
      })

    const result = await resolveLocalUser({
      clerkUserId: "user_new",
      email: "pending@example.com",
      fullName: "Pending Surveyor",
      phone: null,
      profileFetched: true,
    })

    expect(result).toEqual(
      expect.objectContaining({
        id: "uuid-pending",
        clerkUserId: "user_new",
      })
    )
    expect(userCreate).not.toHaveBeenCalled()
  })

  it("creates a new user when profile is fetched and no local row exists", async () => {
    findUnique.mockResolvedValue(null)
    userCreate.mockResolvedValue({
      id: "u2",
      clerkUserId: "user_new",
      email: "b@example.com",
      fullName: "Bob",
      phone: null,
      isActive: true,
    })

    const result = await resolveLocalUser({
      clerkUserId: "user_new",
      email: "b@example.com",
      fullName: "Bob",
      phone: null,
      profileFetched: true,
    })

    expect(userCreate).toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        id: "u2",
        clerkUserId: "user_new",
        email: "b@example.com",
        permissions: ["survey:view"],
      })
    )
  })
})
