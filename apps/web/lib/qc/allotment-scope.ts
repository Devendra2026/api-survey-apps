export type TenantRoleLike = {
  isActive: boolean
  stateId?: string | null
  districtId?: string | null
  ulbId?: string | null
  wardId?: string | null
}

export type QcScopeState = {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
}

export const emptyQcScope = (): QcScopeState => ({
  stateId: "",
  districtId: "",
  ulbId: "",
  wardId: "",
})

/** Prefer a single active ward or single All-Wards ULB allotment over geo list fallbacks. */
export function allotmentScopeFromProfile(tenantRoles: TenantRoleLike[] | undefined): QcScopeState | null {
  const active = tenantRoles?.filter((r) => r.isActive) ?? []
  const withWard = active.filter((r) => Boolean(r.wardId))
  if (withWard.length === 1) {
    const r = withWard[0]!
    return {
      stateId: r.stateId ?? "",
      districtId: r.districtId ?? "",
      ulbId: r.ulbId ?? "",
      wardId: r.wardId ?? "",
    }
  }
  const ulbOnly = active.filter((r) => Boolean(r.ulbId) && !r.wardId)
  if (withWard.length === 0 && ulbOnly.length === 1) {
    const r = ulbOnly[0]!
    return {
      stateId: r.stateId ?? "",
      districtId: r.districtId ?? "",
      ulbId: r.ulbId ?? "",
      wardId: "",
    }
  }
  return null
}

export function isScopeWithinAllotment(scope: QcScopeState, tenantRoles: TenantRoleLike[] | undefined): boolean {
  const allotment = allotmentScopeFromProfile(tenantRoles)
  if (!allotment) return true
  if (allotment.stateId && scope.stateId && scope.stateId !== allotment.stateId) return false
  if (allotment.districtId && scope.districtId && scope.districtId !== allotment.districtId) return false
  if (allotment.ulbId && scope.ulbId && scope.ulbId !== allotment.ulbId) return false
  if (allotment.wardId && scope.wardId && scope.wardId !== allotment.wardId) return false
  return true
}

export function isWorkingContextWithinAllotment(
  context: { activeWardId: string | null; activeUlbId: string | null },
  tenantRoles: TenantRoleLike[] | undefined
): boolean {
  if (!context.activeUlbId && !context.activeWardId) return true
  const allotment = allotmentScopeFromProfile(tenantRoles)
  if (!allotment) return true
  if (allotment.ulbId && context.activeUlbId && context.activeUlbId !== allotment.ulbId) return false
  if (allotment.wardId && context.activeWardId && context.activeWardId !== allotment.wardId) return false
  return true
}
