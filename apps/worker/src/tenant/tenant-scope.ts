import type { Prisma } from "@workspace/database"
import type { TenantRolePayload } from "@workspace/jobs"

interface TenantScope {
  isGlobal: boolean
  stateIds: string[]
  districtIds: string[]
  ulbIds: string[]
  wardIds: string[]
}

export function resolveTenantScope(roles: TenantRolePayload[]): TenantScope {
  const active = roles.filter((role) => role.isActive)
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

export function buildTenantWhere(scope: TenantScope): Prisma.SurveyWhereInput | undefined {
  if (scope.isGlobal) return undefined
  const or: Prisma.SurveyWhereInput[] = []
  if (scope.wardIds.length) or.push({ wardId: { in: scope.wardIds } })
  if (scope.ulbIds.length) or.push({ ulbId: { in: scope.ulbIds } })
  if (scope.districtIds.length) or.push({ districtId: { in: scope.districtIds } })
  if (scope.stateIds.length) or.push({ stateId: { in: scope.stateIds } })
  return or.length ? { OR: or } : { id: "__no_access__" }
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
  return false
}
