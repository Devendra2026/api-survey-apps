import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"

const deleteUser = jest.fn(() => Promise.resolve(undefined))

jest.unstable_mockModule("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: { deleteUser },
  }),
}))

const { UsersService } = await import("./users.service.js")

describe("UsersService.remove (lifecycle)", () => {
  const admin: AuthenticatedUser = {
    id: "admin1",
    clerkUserId: "clerk-admin",
    email: "admin@test.com",
    fullName: "Admin",
    phone: null,
    isActive: true,
    permissions: ["user:delete"],
    tenantRoles: [
      {
        id: "tr-admin",
        roleId: "r-admin",
        roleName: "ADMIN",
        permissions: ["user:delete", "user:view"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const targetUser = {
    id: "user2",
    clerkUserId: "clerk-user2",
    email: "user2@test.com",
    fullName: "User Two",
    phone: null,
    isActive: true,
    tenantRoles: [
      {
        id: "tr2",
        roleId: "r2",
        roleName: "SURVEYOR",
        isActive: true,
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        role: { name: "SURVEYOR" },
      },
    ],
  }

  const emptyBlockers = {
    surveysCreated: 0,
    surveysAssigned: 0,
    surveyAuditsChanged: 0,
    securityAuditsActor: 0,
    importJobsCreated: 0,
    exportJobsCreated: 0,
    qcRemarksAuthored: 0,
    rolesAssigned: 0,
    rolesDeactivated: 0,
  }

  const usersRepository = {
    findById: jest.fn(),
    countDeleteBlockers: jest.fn(),
    hardDelete: jest.fn(),
    deactivateIdentity: jest.fn(),
  }

  const prisma = {
    db: {
      securityAudit: { create: jest.fn() },
    },
  }

  const configService = {
    get: jest.fn(),
  }

  const service = new UsersService(
    usersRepository as never,
    prisma as never,
    {} as never,
    {} as never,
    configService as never
  )

  beforeEach(() => {
    jest.clearAllMocks()
    deleteUser.mockReset()
    deleteUser.mockResolvedValue(undefined)
    configService.get.mockReturnValue("sk_test_key")
    usersRepository.findById.mockResolvedValue(targetUser as never)
    usersRepository.countDeleteBlockers.mockResolvedValue(emptyBlockers as never)
    usersRepository.hardDelete.mockResolvedValue(targetUser as never)
    usersRepository.deactivateIdentity.mockResolvedValue("deactivated" as never)
    prisma.db.securityAudit.create.mockResolvedValue({} as never)
  })

  it("forbids deleting yourself", async () => {
    await expect(service.remove(admin.id, admin)).rejects.toThrow(ForbiddenException)
    expect(usersRepository.hardDelete).not.toHaveBeenCalled()
  })

  it("deactivates and revokes Clerk when Restrict FKs exist", async () => {
    usersRepository.countDeleteBlockers.mockResolvedValue({
      ...emptyBlockers,
      surveysCreated: 3,
      surveyAuditsChanged: 12,
    } as never)

    const result = await service.remove("user2", admin)

    expect(result).toEqual({
      id: "user2",
      deleted: false,
      deactivated: true,
      historyRetained: true,
      reasons: ["3 surveys created", "12 survey audit entries"],
    })
    expect(usersRepository.deactivateIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user2",
        actorId: admin.id,
        source: "admin.delete.history_retained",
      })
    )
    expect(usersRepository.hardDelete).not.toHaveBeenCalled()
    expect(deleteUser).toHaveBeenCalledWith("clerk-user2")
  })

  it("deletes Clerk before hard-deleting DB when clear", async () => {
    const result = await service.remove("user2", admin)

    expect(result).toEqual({
      id: "user2",
      deleted: true,
      deactivated: false,
      historyRetained: false,
    })
    expect(deleteUser).toHaveBeenCalledWith("clerk-user2")
    expect(usersRepository.hardDelete).toHaveBeenCalledWith("user2")
    expect(prisma.db.securityAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETED",
        actorId: admin.id,
        targetType: "User",
        targetId: "user2",
      }),
    })
  })

  it("skips Clerk delete for pending users", async () => {
    usersRepository.findById.mockResolvedValue({
      ...targetUser,
      clerkUserId: "pending:user2@test.com",
    } as never)

    await service.remove("user2", admin)

    expect(usersRepository.hardDelete).toHaveBeenCalledWith("user2")
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it("treats Clerk not-found as success before hard delete", async () => {
    deleteUser.mockRejectedValue({ status: 404, message: "Not Found" })

    const result = await service.remove("user2", admin)

    expect(result).toEqual({
      id: "user2",
      deleted: true,
      deactivated: false,
      historyRetained: false,
    })
    expect(usersRepository.hardDelete).toHaveBeenCalled()
  })

  it("deactivates and errors when Clerk delete fails before hard delete", async () => {
    deleteUser.mockRejectedValue({ status: 500, message: "Clerk down" })

    await expect(service.remove("user2", admin)).rejects.toThrow(ServiceUnavailableException)
    expect(usersRepository.deactivateIdentity).toHaveBeenCalled()
    expect(usersRepository.hardDelete).not.toHaveBeenCalled()
  })
})
