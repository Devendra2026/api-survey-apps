import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"

jest.unstable_mockModule("@clerk/backend", () => ({
  createClerkClient: () => ({
    users: { deleteUser: jest.fn() },
  }),
}))

const { UsersService } = await import("./users.service.js")

function pendingUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: "user-pending",
    clerkUserId: "clerk-pending",
    email: "pending@test.com",
    fullName: "Pending User",
    phone: null,
    isActive: true,
    permissions: [],
    tenantRoles: [
      {
        id: "tr-pending",
        roleId: "r-pending",
        roleName: "PENDING_APPROVAL",
        permissions: [],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
    ...overrides,
  }
}

function surveyorUser(): AuthenticatedUser {
  return {
    id: "user-surveyor",
    clerkUserId: "clerk-surveyor",
    email: "surveyor@test.com",
    fullName: "Active Surveyor",
    phone: null,
    isActive: true,
    permissions: ["survey:view", "survey:create"],
    tenantRoles: [
      {
        id: "tr-surveyor",
        roleId: "r-surveyor",
        roleName: "SURVEYOR",
        permissions: ["survey:view", "survey:create"],
        stateId: "s1",
        districtId: "d1",
        ulbId: "u1",
        wardId: "w1",
        isActive: true,
      },
    ],
  }
}

describe("UsersService.sync (requestedRole)", () => {
  const usersRepository = {
    update: jest.fn(),
    findById: jest.fn(),
  }

  const prisma = { db: {} }
  const clerkUserSync = { syncFromClerk: jest.fn() }
  const userImport = { getTemplateCsv: jest.fn(), importFile: jest.fn() }
  const config = { get: jest.fn() }

  let service: InstanceType<typeof UsersService>

  beforeEach(() => {
    jest.clearAllMocks()
    usersRepository.update.mockImplementation((_id: string, data: Record<string, unknown>) =>
      Promise.resolve({ id: _id, ...data })
    )
    service = new UsersService(
      usersRepository as never,
      prisma as never,
      clerkUserSync as never,
      userImport as never,
      config as never
    )
  })

  it("sets requestedRole while user is PENDING_APPROVAL", async () => {
    const user = pendingUser()
    await service.sync(user, { requestedRole: "SURVEYOR" })

    expect(usersRepository.update).toHaveBeenCalledWith("user-pending", {
      requestedRole: "SURVEYOR",
    })
  })

  it("sets FIELD_SUPERVISOR requestedRole for pending users", async () => {
    const user = pendingUser()
    await service.sync(user, { fullName: "Pending User", requestedRole: "FIELD_SUPERVISOR" })

    expect(usersRepository.update).toHaveBeenCalledWith("user-pending", {
      fullName: "Pending User",
      requestedRole: "FIELD_SUPERVISOR",
    })
  })

  it("ignores requestedRole once the user is onboarded", async () => {
    const user = surveyorUser()
    await service.sync(user, { requestedRole: "FIELD_SUPERVISOR", fullName: "Active Surveyor" })

    expect(usersRepository.update).toHaveBeenCalledWith("user-surveyor", {
      fullName: "Active Surveyor",
    })
    expect(usersRepository.update.mock.calls[0]?.[1]).not.toHaveProperty("requestedRole")
  })

  it("allows requestedRole when there are no active tenant roles yet", async () => {
    const user = pendingUser({ tenantRoles: [] })
    await service.sync(user, { requestedRole: "SURVEYOR" })

    expect(usersRepository.update).toHaveBeenCalledWith("user-pending", {
      requestedRole: "SURVEYOR",
    })
  })

  it("replaces a pending requestedRole with a different role on the same user", async () => {
    const user = pendingUser()
    await service.sync(user, { requestedRole: "FIELD_SUPERVISOR" })

    expect(usersRepository.update).toHaveBeenCalledWith("user-pending", {
      requestedRole: "FIELD_SUPERVISOR",
    })
    expect(usersRepository.update).toHaveBeenCalledTimes(1)
  })
})
