import type { AuthenticatedProfile, TenantRole } from "../../../types/user.ts"

/**
 * Geography a field user may start surveys in, read from the server-issued `tenantRoles`.
 * Display/selection only — `POST /surveys` re-checks permission and tenant scope.
 */
export type SurveyAssignment = {
  key: string
  stateId: string
  districtId: string
  ulbId: string
  ulbName: string
  /** Admin-assigned ULB code. Null when the profile did not include one. */
  ulbCode: string | null
  /** null = role covers every ward of the ULB. */
  wardId: string | null
  wardNumber: string | null
  wardLabel: string | null
}

function roleCode(role: TenantRole): string {
  return role.role?.name ?? role.roleName ?? "UNKNOWN"
}

export function hasActiveRole(profile: AuthenticatedProfile, code: string): boolean {
  return (profile.tenantRoles ?? []).some((r) => r.isActive && roleCode(r) === code)
}

export function surveyAssignments(profile: AuthenticatedProfile): SurveyAssignment[] {
  const out = new Map<string, SurveyAssignment>()
  for (const role of profile.tenantRoles ?? []) {
    if (!role.isActive || roleCode(role) === "PENDING_APPROVAL") continue
    if (!role.stateId || !role.districtId || !role.ulbId) continue
    const key = `${role.ulbId}:${role.wardId ?? "*"}`
    if (out.has(key)) continue
    const ulbCode = role.ulb?.code?.trim() ?? ""
    const wardNumber = role.ward?.wardNumber?.trim() ?? ""
    out.set(key, {
      key,
      stateId: role.stateId,
      districtId: role.districtId,
      ulbId: role.ulbId,
      ulbName: role.ulb?.name ?? "ULB",
      ulbCode: ulbCode || null,
      wardId: role.wardId ?? null,
      wardNumber: wardNumber || null,
      wardLabel: role.ward ? `${role.ward.wardNumber} · ${role.ward.wardName}` : null,
    })
  }
  // A ULB-wide role already covers that ULB's individual wards.
  const ulbWide = new Set([...out.values()].filter((a) => a.wardId === null).map((a) => a.ulbId))
  return [...out.values()]
    .filter((a) => a.wardId === null || !ulbWide.has(a.ulbId))
    .sort((a, b) => (a.ulbName + (a.wardLabel ?? "")).localeCompare(b.ulbName + (b.wardLabel ?? "")))
}

export function temporaryPropertyId(uuid: string): string {
  return `TEMP-MOBILE-${uuid.replace(/-/g, "").slice(0, 16).toUpperCase()}`
}
