import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, ForbiddenException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"

const deleteUser = jest.fn(() => Promise.resolve(undefined))

jest.unstable_mockModule("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: { deleteUser },
  }),
}))

const { UsersService } = await import("./users.service.js")

describe("UsersService.remove (hard delete)", () => {
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
    prisma.db.securityAudit.create.mockResolvedValue({} as never)
  })

  it("forbids deleting yourself", async () => {
    await expect(service.remove(admin.id, admin)).rejects.toThrow(ForbiddenException)
    expect(usersRepository.hardDelete).not.toHaveBeenCalled()
  })

  it("blocks delete when Restrict FKs exist", async () => {
    usersRepository.countDeleteBlockers.mockResolvedValue({
      ...emptyBlockers,
      surveysCreated: 3,
      surveyAuditsChanged: 12,
    } as never)

    await expect(service.remove("user2", admin)).rejects.toThrow(ConflictException)
    await expect(service.remove("user2", admin)).rejects.toThrow(/3 surveys created/)
    expect(usersRepository.hardDelete).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it("hard-deletes DB user and Clerk user when clear", async () => {
    const result = await service.remove("user2", admin)

    expect(result).toEqual({ id: "user2", deleted: true })
    expect(prisma.db.securityAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "USER_DELETED",
        actorId: admin.id,
        targetType: "User",
        targetId: "user2",
      }),
    })
    expect(usersRepository.hardDelete).toHaveBeenCalledWith("user2")
    expect(deleteUser).toHaveBeenCalledWith("clerk-user2")
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

  it("treats Clerk not-found as success after DB delete", async () => {
    deleteUser.mockRejectedValue({ status: 404, message: "Not Found" })

    const result = await service.remove("user2", admin)

    expect(result).toEqual({ id: "user2", deleted: true })
    expect(usersRepository.hardDelete).toHaveBeenCalled()
  })
})
