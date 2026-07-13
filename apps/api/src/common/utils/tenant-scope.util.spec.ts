import type { TenantRoleAssignment } from "../interfaces/authenticated-user.interface.js"
import { buildTenantWhere, canAccessTenant, resolveTenantScope } from "./tenant-scope.util.js"

describe("tenant-scope.util", () => {
  const baseRole = (overrides: Partial<TenantRoleAssignment>): TenantRoleAssignment => ({
    id: "1",
    roleId: "r1",
    roleName: "SURVEYOR",
    stateId: null,
    districtId: null,
    ulbId: null,
    wardId: null,
    isActive: true,
    ...overrides,
  })

  it("marks global when all geo fields are null", () => {
    const scope = resolveTenantScope([baseRole({})])
    expect(scope.isGlobal).toBe(true)
    expect(buildTenantWhere(scope)).toBeUndefined()
  })

  it("collects ulb and ward scopes", () => {
    const scope = resolveTenantScope([baseRole({ ulbId: "ulb1" }), baseRole({ id: "2", wardId: "ward1" })])
    expect(scope.isGlobal).toBe(false)
    expect(scope.ulbIds).toEqual(["ulb1"])
    expect(scope.wardIds).toEqual(["ward1"])
  })

  it("allows access within ulb scope", () => {
    const scope = resolveTenantScope([baseRole({ ulbId: "ulb1" })])
    expect(canAccessTenant(scope, { ulbId: "ulb1", wardId: "w1" })).toBe(true)
    expect(canAccessTenant(scope, { ulbId: "ulb2" })).toBe(false)
  })

  it("returns impossible filter when no scope", () => {
    const scope = resolveTenantScope([])
    expect(buildTenantWhere(scope)).toEqual({ id: "__no_access__" })
  })
})
