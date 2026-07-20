import type { TenantRoleAssignment } from "../interfaces/authenticated-user.interface.js"
import {
  assignmentCoversGeo,
  buildTenantWhere,
  canAccessTenant,
  canGrantRole,
  resolveTenantScope,
  userHasPermissionInTenant,
} from "./tenant-scope.util.js"

describe("tenant-scope.util", () => {
  const baseRole = (overrides: Partial<TenantRoleAssignment>): TenantRoleAssignment => ({
    id: "1",
    roleId: "r1",
    roleName: "SURVEYOR",
    permissions: ["survey:view"],
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

  it("does not leak admin permission across tenant scopes", () => {
    const user = {
      id: "u1",
      clerkUserId: "c1",
      email: "a@b.c",
      fullName: "A",
      phone: null,
      isActive: true,
      permissions: ["survey:approve", "survey:view"],
      tenantRoles: [
        baseRole({
          id: "a",
          roleName: "QC_SUPERVISOR",
          permissions: ["survey:approve", "survey:view"],
          wardId: "ward-a",
        }),
        baseRole({
          id: "b",
          roleName: "SURVEYOR",
          permissions: ["survey:view"],
          wardId: "ward-b",
        }),
      ],
    }

    expect(userHasPermissionInTenant(user, "survey:approve", { wardId: "ward-a" })).toBe(true)
    expect(userHasPermissionInTenant(user, "survey:approve", { wardId: "ward-b" })).toBe(false)
    expect(userHasPermissionInTenant(user, "survey:view", { wardId: "ward-b" })).toBe(true)
    expect(assignmentCoversGeo(user.tenantRoles[0], { wardId: "ward-b" })).toBe(false)
  })

  it("enforces role grant ceilings", () => {
    expect(canGrantRole(["ADMIN"], "SURVEYOR")).toBe(true)
    expect(canGrantRole(["ADMIN"], "QC_SUPERVISOR")).toBe(true)
    expect(canGrantRole(["FIELD_SUPERVISOR"], "ADMIN")).toBe(false)
    expect(canGrantRole(["FIELD_SUPERVISOR"], "SURVEYOR")).toBe(true)
    expect(canGrantRole(["QC_SUPERVISOR"], "SURVEYOR")).toBe(false)
  })
})
