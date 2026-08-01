import { describe, expect, it } from "@jest/globals"
import type { TenantRoleAssignment } from "../interfaces/authenticated-user.interface.js"
import {
  assignmentCoversGeo,
  buildTenantWhere,
  canAccessTenant,
  canGrantRole,
  resolveTenantScope,
  userHasAdminRole,
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

  it("collects parent geos from ward allotments without widening buildTenantWhere", () => {
    const scope = resolveTenantScope([
      baseRole({
        id: "qc-ward",
        roleName: "QC_SUPERVISOR",
        stateId: "st1",
        districtId: "dist1",
        ulbId: "ulb1",
        wardId: "ward10",
      }),
    ])

    expect(scope.wardIds).toEqual(["ward10"])
    expect(scope.ulbIds).toEqual([])
    expect(scope.districtIds).toEqual([])
    expect(scope.stateIds).toEqual([])
    expect(scope.parentUlbIds).toEqual(["ulb1"])
    expect(scope.parentDistrictIds).toEqual(["dist1"])
    expect(scope.parentStateIds).toEqual(["st1"])
    expect(buildTenantWhere(scope)).toEqual({ OR: [{ wardId: { in: ["ward10"] } }] })
  })

  it("allows access within ulb scope", () => {
    const scope = resolveTenantScope([baseRole({ ulbId: "ulb1" })])
    expect(canAccessTenant(scope, { ulbId: "ulb1", wardId: "w1" })).toBe(true)
    expect(canAccessTenant(scope, { ulbId: "ulb2" })).toBe(false)
  })

  it("allows ward-scoped QC parent district/ulb query geo without granting foreign wards", () => {
    const scope = resolveTenantScope([
      baseRole({
        id: "qc-ward",
        roleName: "QC_SUPERVISOR",
        stateId: "st1",
        districtId: "dist1",
        ulbId: "ulb1",
        wardId: "ward10",
      }),
    ])

    // Registry header auto-sends Etah district + ULB without wardId
    expect(canAccessTenant(scope, { districtId: "dist1", ulbId: "ulb1" })).toBe(true)
    expect(canAccessTenant(scope, { districtId: "dist1" })).toBe(true)
    expect(canAccessTenant(scope, { ulbId: "ulb1" })).toBe(true)
    expect(canAccessTenant(scope, { wardId: "ward10" })).toBe(true)

    // Foreign parent / mismatched ward stay denied
    expect(canAccessTenant(scope, { ulbId: "ulb-other" })).toBe(false)
    expect(canAccessTenant(scope, { districtId: "dist-other" })).toBe(false)
    expect(canAccessTenant(scope, { wardId: "ward-other", ulbId: "ulb1" })).toBe(false)
  })

  it("supports All Wards QC allotment (ulb scope) without parent-only 403", () => {
    const scope = resolveTenantScope([
      baseRole({
        id: "qc-all-wards",
        roleName: "QC_SUPERVISOR",
        stateId: "st1",
        districtId: "dist1",
        ulbId: "ulb1",
        wardId: null,
      }),
    ])

    expect(scope.ulbIds).toEqual(["ulb1"])
    expect(scope.wardIds).toEqual([])
    expect(buildTenantWhere(scope)).toEqual({ OR: [{ ulbId: { in: ["ulb1"] } }] })
    expect(canAccessTenant(scope, { districtId: "dist1", ulbId: "ulb1" })).toBe(true)
    expect(canAccessTenant(scope, { ulbId: "ulb1", wardId: "any-ward" })).toBe(true)
    expect(canAccessTenant(scope, { ulbId: "ulb-other" })).toBe(false)
  })

  it("keeps single-ward QC supervisors isolated to their own ward data filter", () => {
    const qcWard10 = resolveTenantScope([
      baseRole({
        id: "preeti",
        roleName: "QC_SUPERVISOR",
        stateId: "st1",
        districtId: "dist1",
        ulbId: "ulb1",
        wardId: "ward10",
      }),
    ])
    const qcWard5 = resolveTenantScope([
      baseRole({
        id: "other-qc",
        roleName: "QC_SUPERVISOR",
        stateId: "st1",
        districtId: "dist1",
        ulbId: "ulb1",
        wardId: "ward5",
      }),
    ])

    expect(buildTenantWhere(qcWard10)).toEqual({ OR: [{ wardId: { in: ["ward10"] } }] })
    expect(buildTenantWhere(qcWard5)).toEqual({ OR: [{ wardId: { in: ["ward5"] } }] })
    expect(canAccessTenant(qcWard10, { wardId: "ward5", ulbId: "ulb1" })).toBe(false)
    expect(canAccessTenant(qcWard5, { wardId: "ward10", ulbId: "ulb1" })).toBe(false)
  })

  it("returns impossible filter when no scope", () => {
    const scope = resolveTenantScope([])
    expect(buildTenantWhere(scope)).toEqual({ id: "__no_access__" })
  })

  it("does not leak admin permission across tenant scopes", () => {
    const qcRoleWardA = baseRole({
      id: "a",
      roleName: "QC_SUPERVISOR",
      permissions: ["survey:approve", "survey:view"],
      wardId: "ward-a",
    })
    const surveyorRoleWardB = baseRole({
      id: "b",
      roleName: "SURVEYOR",
      permissions: ["survey:view"],
      wardId: "ward-b",
    })
    const user = {
      id: "u1",
      clerkUserId: "c1",
      email: "a@b.c",
      fullName: "A",
      phone: null,
      isActive: true,
      permissions: ["survey:approve", "survey:view"],
      tenantRoles: [qcRoleWardA, surveyorRoleWardB],
    }

    expect(userHasPermissionInTenant(user, "survey:approve", { wardId: "ward-a" })).toBe(true)
    expect(userHasPermissionInTenant(user, "survey:approve", { wardId: "ward-b" })).toBe(false)
    expect(userHasPermissionInTenant(user, "survey:view", { wardId: "ward-b" })).toBe(true)
    expect(assignmentCoversGeo(qcRoleWardA, { wardId: "ward-b" })).toBe(false)
  })

  it("enforces role grant ceilings", () => {
    expect(canGrantRole(["ADMIN"], "SURVEYOR")).toBe(true)
    expect(canGrantRole(["ADMIN"], "QC_SUPERVISOR")).toBe(true)
    expect(canGrantRole(["ADMIN"], "DEPT_ADMIN")).toBe(true)
    expect(canGrantRole(["FIELD_SUPERVISOR"], "ADMIN")).toBe(false)
    expect(canGrantRole(["FIELD_SUPERVISOR"], "SURVEYOR")).toBe(true)
    expect(canGrantRole(["QC_SUPERVISOR"], "SURVEYOR")).toBe(false)
    expect(canGrantRole(["DEPT_ADMIN"], "DEPT_CLERK")).toBe(true)
    expect(canGrantRole(["DEPT_ADMIN"], "DEPT_OPERATOR")).toBe(true)
    expect(canGrantRole(["DEPT_ADMIN"], "ADMIN")).toBe(false)
    expect(canGrantRole(["DEPT_CLERK"], "DEPT_OPERATOR")).toBe(false)
  })

  it("detects Admin role by active roleName", () => {
    const adminUser = {
      id: "u1",
      clerkUserId: "c1",
      email: "a@b.c",
      fullName: "A",
      phone: null,
      isActive: true,
      permissions: ["settings:manage"],
      tenantRoles: [baseRole({ roleName: "ADMIN", permissions: ["settings:manage"] })],
    }
    const deptAdmin = {
      ...adminUser,
      tenantRoles: [baseRole({ roleName: "DEPT_ADMIN", permissions: ["settings:manage"] })],
    }
    const inactiveAdmin = {
      ...adminUser,
      tenantRoles: [baseRole({ roleName: "ADMIN", permissions: ["settings:manage"], isActive: false })],
    }

    expect(userHasAdminRole(adminUser)).toBe(true)
    expect(userHasAdminRole(deptAdmin)).toBe(false)
    expect(userHasAdminRole(inactiveAdmin)).toBe(false)
  })
})
