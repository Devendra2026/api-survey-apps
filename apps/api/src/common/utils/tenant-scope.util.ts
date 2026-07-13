import type { Prisma } from "@workspace/database"
import type { TenantRoleAssignment, TenantScope } from "../interfaces/authenticated-user.interface.js"

export function resolveTenantScope(roles: TenantRoleAssignment[]): TenantScope {
  const active = roles.filter((r) => r.isActive)
  const scope: TenantScope = {
    isGlobal: false,
    stateIds: [],
    districtIds: [],
    ulbIds: [],
    wardIds: [],
  }

  for (const role of active) {
    if (!role.stateId && !role.districtId && !role.ulbId && !role.wardId) {
      scope.isGlobal = true
      continue
    }
    if (role.wardId) scope.wardIds.push(role.wardId)
    else if (role.ulbId) scope.ulbIds.push(role.ulbId)
    else if (role.districtId) scope.districtIds.push(role.districtId)
    else if (role.stateId) scope.stateIds.push(role.stateId)
  }

  scope.stateIds = [...new Set(scope.stateIds)]
  scope.districtIds = [...new Set(scope.districtIds)]
  scope.ulbIds = [...new Set(scope.ulbIds)]
  scope.wardIds = [...new Set(scope.wardIds)]

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

export function canAccessTenant(
  scope: TenantScope,
  geo: { stateId?: string | null; districtId?: string | null; ulbId?: string | null; wardId?: string | null }
): boolean {
  if (scope.isGlobal) return true

  if (geo.wardId && scope.wardIds.includes(geo.wardId)) return true
  if (geo.ulbId && scope.ulbIds.includes(geo.ulbId)) return true
  if (geo.districtId && scope.districtIds.includes(geo.districtId)) return true
  if (geo.stateId && scope.stateIds.includes(geo.stateId)) return true

  // Ward-scoped user accessing via parent: if user's ward is under target ulb we already matched wardId on resource.
  // Broader resource check: user with ulb scope can access ward under that ulb when resource has ulbId.
  if (geo.ulbId && scope.wardIds.length === 0 && scope.ulbIds.includes(geo.ulbId)) return true

  return false
}

export function buildStateTenantWhere(scope: TenantScope): Prisma.StateWhereInput | undefined {
  if (scope.isGlobal) return undefined
  if (scope.stateIds.length || scope.districtIds.length || scope.ulbIds.length || scope.wardIds.length) {
    // Can see states that appear in any of their scoped assignments
    const ids = new Set(scope.stateIds)
    // If only lower levels assigned, we still need to allow listing — filter at query via related IDs in service
    if (ids.size) return { id: { in: [...ids] } }
  }
  return { id: "__no_access__" }
}
