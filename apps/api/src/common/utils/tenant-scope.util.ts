import type { Prisma } from "@workspace/database"
import type {
  AuthenticatedUser,
  TenantGeo,
  TenantRoleAssignment,
  TenantScope,
} from "../interfaces/authenticated-user.interface.js"

export function resolveTenantScope(roles: TenantRoleAssignment[]): TenantScope {
  const active = roles.filter((r) => r.isActive)
  const scope: TenantScope = {
    isGlobal: false,
    stateIds: [],
    districtIds: [],
    ulbIds: [],
    wardIds: [],
    parentStateIds: [],
    parentDistrictIds: [],
    parentUlbIds: [],
  }

  for (const role of active) {
    if (!role.stateId && !role.districtId && !role.ulbId && !role.wardId) {
      scope.isGlobal = true
      continue
    }
    if (role.wardId) {
      scope.wardIds.push(role.wardId)
      // Parents are guard-only so query filters like districtId/ulbId do not 403
      if (role.ulbId) scope.parentUlbIds.push(role.ulbId)
      if (role.districtId) scope.parentDistrictIds.push(role.districtId)
      if (role.stateId) scope.parentStateIds.push(role.stateId)
    } else if (role.ulbId) {
      scope.ulbIds.push(role.ulbId)
      if (role.districtId) scope.parentDistrictIds.push(role.districtId)
      if (role.stateId) scope.parentStateIds.push(role.stateId)
    } else if (role.districtId) {
      scope.districtIds.push(role.districtId)
      if (role.stateId) scope.parentStateIds.push(role.stateId)
    } else if (role.stateId) {
      scope.stateIds.push(role.stateId)
    }
  }

  scope.stateIds = [...new Set(scope.stateIds)]
  scope.districtIds = [...new Set(scope.districtIds)]
  scope.ulbIds = [...new Set(scope.ulbIds)]
  scope.wardIds = [...new Set(scope.wardIds)]
  scope.parentStateIds = [...new Set(scope.parentStateIds)]
  scope.parentDistrictIds = [...new Set(scope.parentDistrictIds)]
  scope.parentUlbIds = [...new Set(scope.parentUlbIds)]

  return scope
}

/**
 * Builds a Prisma OR filter for Survey (or any model with stateId/districtId/ulbId/wardId).
 * Returns undefined when global (no filter). Returns impossible filter when no scope.
 */
export function buildTenantWhere(scope: TenantScope): Prisma.SurveyWhereInput | undefined {
  if (scope.isGlobal) return undefined

  const or: Prisma.SurveyWhereInput[] = []
  if (scope.wardIds.length) or.push({ wardId: { in: scope.wardIds } })
  if (scope.ulbIds.length) or.push({ ulbId: { in: scope.ulbIds } })
  if (scope.districtIds.length) or.push({ districtId: { in: scope.districtIds } })
  if (scope.stateIds.length) or.push({ stateId: { in: scope.stateIds } })

  if (!or.length) {
    return { id: "__no_access__" }
  }

  return { OR: or }
}

/** Whether an assignment's geographic scope covers the target geo. */
export function assignmentCoversGeo(role: TenantRoleAssignment, geo: TenantGeo): boolean {
  if (!role.isActive) return false
  if (!role.stateId && !role.districtId && !role.ulbId && !role.wardId) {
    return true // global assignment
  }

  if (role.wardId) {
    return Boolean(geo.wardId && geo.wardId === role.wardId)
  }
  if (role.ulbId) {
    return Boolean(geo.ulbId && geo.ulbId === role.ulbId)
  }
  if (role.districtId) {
    return Boolean(geo.districtId && geo.districtId === role.districtId)
  }
  if (role.stateId) {
    return Boolean(geo.stateId && geo.stateId === role.stateId)
  }
  return false
}

/**
 * Permission check bound to the tenant of the target resource.
 * An ADMIN role in Ward A does NOT grant admin permission in Ward B.
 */
export function userHasPermissionInTenant(user: AuthenticatedUser, permission: string, geo: TenantGeo): boolean {
  return user.tenantRoles.some(
    (role) => role.isActive && role.permissions.includes(permission) && assignmentCoversGeo(role, geo)
  )
}

/** True when the user has any active tenant role named ADMIN. */
export function userHasAdminRole(user: AuthenticatedUser): boolean {
  return user.tenantRoles.some((role) => role.isActive && role.roleName === "ADMIN")
}

export function userHasAnyPermissionInTenant(user: AuthenticatedUser, permissions: string[], geo: TenantGeo): boolean {
  return permissions.some((p) => userHasPermissionInTenant(user, p, geo))
}

export function canAccessTenant(scope: TenantScope, geo: TenantGeo): boolean {
  if (scope.isGlobal) return true

  if (geo.wardId && scope.wardIds.includes(geo.wardId)) return true
  if (geo.ulbId && scope.ulbIds.includes(geo.ulbId)) return true
  if (geo.districtId && scope.districtIds.includes(geo.districtId)) return true
  if (geo.stateId && scope.stateIds.includes(geo.stateId)) return true

  // Do not let parent ULB/district/state bypass an explicit out-of-scope ward.
  if (geo.wardId && scope.wardIds.length > 0 && !scope.wardIds.includes(geo.wardId)) {
    return false
  }

  if (geo.ulbId && scope.parentUlbIds.includes(geo.ulbId)) return true
  if (geo.districtId && scope.parentDistrictIds.includes(geo.districtId)) return true
  if (geo.stateId && scope.parentStateIds.includes(geo.stateId)) return true

  return false
}

/**
 * Strict tenant access: every provided geo field that has scope data must match,
 * and at least one matching level is required when scope is not global.
 */
export function canAccessTenantStrict(scope: TenantScope, geo: TenantGeo): boolean {
  if (scope.isGlobal) return true
  if (!geo.stateId && !geo.districtId && !geo.ulbId && !geo.wardId) return false

  if (geo.wardId && scope.wardIds.length && !scope.wardIds.includes(geo.wardId)) {
    // Ward-scoped users must match ward; ULB-scoped users may access wards under their ULB via ulbId.
    const ulbAllowed =
      Boolean(geo.ulbId) && (scope.ulbIds.includes(geo.ulbId!) || scope.parentUlbIds.includes(geo.ulbId!))
    if (!ulbAllowed) {
      if (!scope.ulbIds.length && !scope.districtIds.length && !scope.stateIds.length) return false
    }
  }

  return canAccessTenant(scope, geo)
}

export function buildStateTenantWhere(scope: TenantScope): Prisma.StateWhereInput | undefined {
  if (scope.isGlobal) return undefined
  if (scope.stateIds.length || scope.districtIds.length || scope.ulbIds.length || scope.wardIds.length) {
    const ids = new Set(scope.stateIds)
    if (ids.size) return { id: { in: [...ids] } }
  }
  return { id: "__no_access__" }
}

/** Roles a given actor role may grant (ceiling). */
export const ROLE_GRANT_CEILINGS: Record<string, string[]> = {
  ADMIN: [
    "ADMIN",
    "QC_SUPERVISOR",
    "FIELD_SUPERVISOR",
    "SURVEYOR",
    "PENDING_APPROVAL",
    "DEPT_ADMIN",
    "DEPT_CLERK",
    "DEPT_OPERATOR",
  ],
  FIELD_SUPERVISOR: ["SURVEYOR", "PENDING_APPROVAL"],
  QC_SUPERVISOR: [],
  SURVEYOR: [],
  PENDING_APPROVAL: [],
  DEPT_ADMIN: ["DEPT_CLERK", "DEPT_OPERATOR"],
  DEPT_CLERK: [],
  DEPT_OPERATOR: [],
}

export const DEPARTMENT_ROLE_NAMES = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])

export function isDepartmentRole(roleName: string): boolean {
  return DEPARTMENT_ROLE_NAMES.has(roleName)
}

export function canGrantRole(actorRoleNames: string[], targetRoleName: string): boolean {
  for (const actorRole of actorRoleNames) {
    const allowed = ROLE_GRANT_CEILINGS[actorRole]
    if (allowed?.includes(targetRoleName)) return true
  }
  return false
}
