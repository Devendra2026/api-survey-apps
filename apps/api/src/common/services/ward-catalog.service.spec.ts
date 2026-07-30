import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser, TenantRoleAssignment } from "../interfaces/authenticated-user.interface.js"
import { WardCatalogService } from "./ward-catalog.service.js"

const catalog = [
  { id: "ward-1", wardName: "Kotwali", wardNumber: "01" },
  { id: "ward-2", wardName: "Civil Lines", wardNumber: "02" },
]

const role = (overrides: Partial<TenantRoleAssignment>): TenantRoleAssignment => ({
  id: "tr1",
  roleId: "r1",
  roleName: "ADMIN",
  permissions: [],
  stateId: null,
  districtId: null,
  ulbId: null,
  wardId: null,
  isActive: true,
  ...overrides,
})

const userWithRoles = (tenantRoles: TenantRoleAssignment[]): AuthenticatedUser =>
  ({
    id: "u1",
    permissions: [],
    tenantRoles,
  }) as unknown as AuthenticatedUser

describe("WardCatalogService.listScopedWards", () => {
  let findMany: jest.Mock<(args: unknown) => Promise<typeof catalog>>
  let findUnique: jest.Mock<() => Promise<unknown>>
  let service: WardCatalogService

  beforeEach(() => {
    findMany = jest.fn(() => Promise.resolve(catalog))
    findUnique = jest.fn(() => Promise.resolve({ districtId: "district-1", district: { stateId: "state-1" } }))
    service = new WardCatalogService({ db: { ward: { findMany }, ulb: { findUnique } } } as never)
  })

  it("lists only active, non-deleted wards for a global user", async () => {
    await expect(service.listScopedWards(userWithRoles([role({})]), "ulb-1")).resolves.toEqual(catalog)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ulbId: "ulb-1", status: "ACTIVE", deletedAt: null },
      })
    )
  })

  it("narrows a ward-scoped user to their own wards", async () => {
    const user = userWithRoles([role({ roleName: "SURVEYOR", wardId: "ward-2" })])
    await expect(service.listScopedWards(user, "ulb-1")).resolves.toEqual([catalog[1]])
  })

  it("returns the full catalog for a district-scoped user", async () => {
    const user = userWithRoles([role({ roleName: "QC_SUPERVISOR", districtId: "district-1" })])
    await expect(service.listScopedWards(user, "ulb-1")).resolves.toEqual(catalog)
  })

  it("returns nothing when the ULB is outside the user's scope", async () => {
    const user = userWithRoles([role({ roleName: "QC_SUPERVISOR", ulbId: "other-ulb" })])
    await expect(service.listScopedWards(user, "ulb-1")).resolves.toEqual([])
  })

  it("returns nothing when the ULB does not exist", async () => {
    findUnique.mockResolvedValueOnce(null)
    await expect(service.listScopedWards(userWithRoles([role({})]), "ulb-1")).resolves.toEqual([])
  })
})
