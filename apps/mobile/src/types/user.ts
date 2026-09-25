export type TenantRole = {
  id: string
  /** Nested role from Prisma includes (preferred for /users/me). */
  role?: { id: string; name: string }
  /** Flat name from auth-context assignments (fallback). */
  roleName?: string
  roleId?: string
  stateId?: string | null
  districtId?: string | null
  ulbId?: string | null
  wardId?: string | null
  isActive: boolean
  state?: { id: string; name: string; code?: string } | null
  district?: { id: string; name: string } | null
  ulb?: { id: string; name: string; code?: string } | null
  ward?: { id: string; wardNumber: string; wardName: string } | null
}

export type AuthenticatedProfile = {
  id: string
  clerkUserId: string
  email: string
  phone?: string | null
  fullName: string
  isActive: boolean
  lastLoginAt?: string | null
  permissions: string[]
  tenantRoles?: TenantRole[]
}

export const ROLE_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  SURVEYOR: "Surveyor",
  FIELD_SUPERVISOR: "Field supervisor",
  QC_SUPERVISOR: "QC supervisor",
  ADMIN: "Admin",
  DEPT_ADMIN: "Department admin",
  DEPT_CLERK: "Department clerk",
  DEPT_OPERATOR: "Department operator",
}

export function tenantRoleCode(role: TenantRole): string {
  return role.role?.name ?? role.roleName ?? "UNKNOWN"
}

export function roleDisplayName(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName
}

export function primaryRoleName(profile: AuthenticatedProfile): string | null {
  const active = (profile.tenantRoles ?? []).filter((role) => role.isActive)
  if (active.length === 0) {
    return null
  }
  const nonPending = active.find((role) => tenantRoleCode(role) !== "PENDING_APPROVAL")
  return tenantRoleCode(nonPending ?? active[0]!)
}

/** Matches web `hasDashboardAccess`: any Nest permission means onboarded. */
export function hasAppAccess(profile: AuthenticatedProfile | null | undefined): boolean {
  return Array.isArray(profile?.permissions) && profile.permissions.length > 0
}

export type AppHomeHref = "/(app)/admin" | "/(app)/survey"

const ADMIN_HOME_ROLES = new Set(["ADMIN"])

/**
 * Post-onboarding home: ADMIN → admin shell; surveyor/supervisor and other
 * onboarded roles → survey shell.
 */
export function resolveAppHomeHref(profile: AuthenticatedProfile | null | undefined): AppHomeHref {
  if (!profile) {
    return "/(app)/survey"
  }
  const role = primaryRoleName(profile)
  if (role && ADMIN_HOME_ROLES.has(role)) {
    return "/(app)/admin"
  }
  return "/(app)/survey"
}
