import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException, ForbiddenException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { WardsService } from "./wards.service.js"

describe("WardsService.delete (Admin only)", () => {
  const deleteFn = jest.fn<(id: string, user: AuthenticatedUser) => Promise<{ id: string; deletedAt: Date }>>(() =>
    Promise.resolve({ id: "ward1", deletedAt: new Date() })
  )
  const createFn = jest.fn((data: { ulbId: string; wardNumber: string; wardName: string }) =>
    Promise.resolve({ id: "ward-new", ...data })
  )
  const updateFn = jest.fn((id: string, data: { wardName?: string }) => Promise.resolve({ id, ...data }))
  const wardsRepository = {
    delete: deleteFn,
    create: createFn,
    update: updateFn,
  }

  let service: WardsService

  beforeEach(() => {
    deleteFn.mockClear()
    createFn.mockClear()
    updateFn.mockClear()
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

  it("allows Admin to delete (soft delete via repository)", async () => {
    const admin = withRole("ADMIN", ["settings:manage"])
    const result = await service.delete("ward1", admin)
    expect(result).toEqual(expect.objectContaining({ id: "ward1" }))
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

  it("propagates duplicate ward name ConflictException from create", async () => {
    createFn.mockRejectedValueOnce(
      new ConflictException("A ward with this name already exists. Please use a different name.")
    )
    await expect(service.create({ ulbId: "ulb1", wardNumber: "9", wardName: "Abhimanyu" })).rejects.toBeInstanceOf(
      ConflictException
    )
  })

  it("propagates duplicate ward name ConflictException from update", async () => {
    const admin = withRole("ADMIN", ["settings:manage"])
    updateFn.mockRejectedValueOnce(
      new ConflictException("A ward with this name already exists. Please use a different name.")
    )
    await expect(service.update("ward1", { wardName: "Abhimanyu" }, admin)).rejects.toBeInstanceOf(ConflictException)
  })
})
