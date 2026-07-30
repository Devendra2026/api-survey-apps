import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ForbiddenException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { PermissionsGuard } from "./permissions.guard.js"

describe("PermissionsGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector

  const guard = new PermissionsGuard(reflector)

  const baseUser = (permissions: string[]): AuthenticatedUser => ({
    id: "u1",
    clerkUserId: "c1",
    email: "a@b.com",
    fullName: "A",
    phone: null,
    isActive: true,
    permissions,
    tenantRoles: [],
  })

  const makeContext = (user?: AuthenticatedUser) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never

  beforeEach(() => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReset()
  })

  it("allows public routes", () => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(true)
    expect(guard.canActivate(makeContext())).toBe(true)
  })

  it("allows when no permissions required", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
    expect(guard.canActivate(makeContext(baseUser([])))).toBe(true)
  })

  it("denies missing AND permission", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(["survey:create"])
    expect(() => guard.canActivate(makeContext(baseUser(["survey:view"])))).toThrow(ForbiddenException)
  })

  it("allows when user has required AND permission", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(["survey:create"])
    expect(guard.canActivate(makeContext(baseUser(["survey:create", "survey:view"])))).toBe(true)
  })

  it("allows OR when user has one of any-required permissions (survey:view)", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(["settings:view", "role:assign", "survey:view"])
      .mockReturnValueOnce(undefined)
    expect(guard.canActivate(makeContext(baseUser(["survey:view"])))).toBe(true)
  })

  it("allows OR when user has role:assign", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(["settings:view", "role:assign", "survey:view"])
      .mockReturnValueOnce(undefined)
    expect(guard.canActivate(makeContext(baseUser(["role:assign", "user:view"])))).toBe(true)
  })

  it("denies OR when user has none of any-required permissions", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(["settings:view", "role:assign", "survey:view"])
      .mockReturnValueOnce(undefined)
    expect(() => guard.canActivate(makeContext(baseUser(["dashboard:view"])))).toThrow(ForbiddenException)
  })

  it("requires both any-of and all-of when both are set", () => {
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(["survey:view", "role:assign"])
      .mockReturnValueOnce(["user:create"])
    expect(() => guard.canActivate(makeContext(baseUser(["survey:view"])))).toThrow(ForbiddenException)
    ;(reflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(["survey:view", "role:assign"])
      .mockReturnValueOnce(["user:create"])
    expect(guard.canActivate(makeContext(baseUser(["survey:view", "user:create"])))).toBe(true)
  })
})
