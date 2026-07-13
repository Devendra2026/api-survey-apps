import { jest } from "@jest/globals"
import { ForbiddenException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { PermissionsGuard } from "./permissions.guard.js"

describe("PermissionsGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector

  const guard = new PermissionsGuard(reflector)

  const makeContext = (user?: AuthenticatedUser) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never

  it("allows public routes", () => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(true)
    expect(guard.canActivate(makeContext())).toBe(true)
  })

  it("allows when no permissions required", () => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(undefined)
    expect(
      guard.canActivate(
        makeContext({
          id: "u1",
          clerkUserId: "c1",
          email: "a@b.com",
          fullName: "A",
          phone: null,
          isActive: true,
          permissions: [],
          tenantRoles: [],
        })
      )
    ).toBe(true)
  })

  it("denies missing permission", () => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(["survey:create"])
    expect(() =>
      guard.canActivate(
        makeContext({
          id: "u1",
          clerkUserId: "c1",
          email: "a@b.com",
          fullName: "A",
          phone: null,
          isActive: true,
          permissions: ["survey:view"],
          tenantRoles: [],
        })
      )
    ).toThrow(ForbiddenException)
  })

  it("allows when user has required permission", () => {
    ;(reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(["survey:create"])
    expect(
      guard.canActivate(
        makeContext({
          id: "u1",
          clerkUserId: "c1",
          email: "a@b.com",
          fullName: "A",
          phone: null,
          isActive: true,
          permissions: ["survey:create", "survey:view"],
          tenantRoles: [],
        })
      )
    ).toBe(true)
  })
})
