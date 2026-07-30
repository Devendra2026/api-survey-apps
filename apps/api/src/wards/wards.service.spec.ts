import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ForbiddenException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { WardsService } from "./wards.service.js"

describe("WardsService.delete (Admin only)", () => {
  const deleteFn = jest.fn(() => Promise.resolve({ id: "ward1" }))
  const wardsRepository = {
    delete: deleteFn,
  }

  let service: WardsService

  beforeEach(() => {
    deleteFn.mockClear()
    service = new WardsService(wardsRepository as never)
  })

  const withRole = (roleName: string, permissions: string[]): AuthenticatedUser => ({
    id: "u1",
    clerkUserId: "c1",
    email: "u@test.com",
    fullName: "User",
    phone: null,
    isActive: true,
    permissions,
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName,
        permissions,
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  })

  it("allows Admin to delete", async () => {
    const admin = withRole("ADMIN", ["settings:manage"])
    await expect(service.delete("ward1", admin)).resolves.toEqual({ id: "ward1" })
    expect(deleteFn).toHaveBeenCalledWith("ward1", admin)
  })

  it("forbids DEPT_ADMIN even with settings:manage", () => {
    const deptAdmin = withRole("DEPT_ADMIN", ["settings:manage"])
    expect(() => service.delete("ward1", deptAdmin)).toThrow(ForbiddenException)
    expect(deleteFn).not.toHaveBeenCalled()
  })

  it("forbids QC supervisor", () => {
    const qc = withRole("QC_SUPERVISOR", ["survey:approve"])
    expect(() => service.delete("ward1", qc)).toThrow(ForbiddenException)
    expect(deleteFn).not.toHaveBeenCalled()
  })
})
