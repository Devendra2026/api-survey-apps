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
  ulb?: { id: string; name: string; code?: string; type?: string | null } | null
  ward?: { id: string; wardNumber: string; wardName: string } | null
}

/** Roles a field user may request at signup. Not authorization. */
export const REQUESTABLE_ROLES = ["SURVEYOR", "FIELD_SUPERVISOR"] as const
export type RequestableRole = (typeof REQUESTABLE_ROLES)[number]

export function isRequestableRole(value: unknown): value is RequestableRole {
  return value === "SURVEYOR" || value === "FIELD_SUPERVISOR"
}

export type AuthenticatedProfile = {
  id: string
  clerkUserId: string
  email: string
  phone?: string | null
  fullName: string
  isActive: boolean
  lastLoginAt?: string | null
  createdAt?: string | null
  /** Signup intent — SURVEYOR | FIELD_SUPERVISOR. Null after admin assigns a working role (may remain for audit). */
  requestedRole?: string | null
  permissions: string[]
  tenantRoles?: TenantRole[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Runtime check for GET /users/me: identity fields must be present before the profile drives navigation. */
export function isAuthenticatedProfile(value: unknown): value is AuthenticatedProfile {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.clerkUserId === "string" &&
    value.clerkUserId.length > 0 &&
    typeof value.email === "string" &&
    typeof value.fullName === "string" &&
    typeof value.isActive === "boolean" &&
    Array.isArray(value.permissions) &&
    value.permissions.every((p) => typeof p === "string") &&
    (value.tenantRoles === undefined || Array.isArray(value.tenantRoles))
  )
}

export const ROLE_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  SURVEYOR: "Surveyor",
  FIELD_SUPERVISOR: "Supervisor",
  QC_SUPERVISOR: "QC supervisor",
  ADMIN: "Admin",
}

const ADMIN_HOME_ROLES = new Set(["ADMIN"])

/** Onboarded roles that open the survey field shell (not admin). */
const SURVEY_HOME_ROLES = new Set([
  "SURVEYOR",
  "FIELD_SUPERVISOR",
  "QC_SUPERVISOR",
])

export function tenantRoleCode(role: TenantRole): string {
  return role.role?.name ?? role.roleName ?? "UNKNOWN"
}

export function roleDisplayName(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName
}

/**
 * Prefer ADMIN when present among active roles so multi-role users do not
 * briefly land on the survey shell. Otherwise first non-pending active role.
 */
export function primaryRoleName(profile: AuthenticatedProfile): string | null {
  const active = (profile.tenantRoles ?? []).filter((role) => role.isActive)
  if (active.length === 0) {
    return null
  }

  const admin = active.find((role) => tenantRoleCode(role) === "ADMIN")
  if (admin) {
    return "ADMIN"
  }

  const nonPending = active.find((role) => tenantRoleCode(role) !== "PENDING_APPROVAL")
  return tenantRoleCode(nonPending ?? active[0]!)
}

/** Matches web `hasDashboardAccess`: any Nest permission means onboarded. */
export function hasAppAccess(profile: AuthenticatedProfile | null | undefined): boolean {
  return Array.isArray(profile?.permissions) && profile.permissions.length > 0
}

export type AppHomeHref = "/(app)/admin" | "/(app)/survey"

/**
 * Post-onboarding home for known mobile roles.
 * Returns null when the user must stay on pending (no permissions, pending-only,
 * or an unrecognized role code).
 */
export function resolveAppHomeHref(profile: AuthenticatedProfile | null | undefined): AppHomeHref | null {
  if (!profile || !hasAppAccess(profile)) {
    return null
  }

  const role = primaryRoleName(profile)
  if (!role || role === "PENDING_APPROVAL") {
    return null
  }
  if (ADMIN_HOME_ROLES.has(role)) {
    return "/(app)/admin"
  }
  if (SURVEY_HOME_ROLES.has(role)) {
    return "/(app)/survey"
  }
  return null
}

/** True when Nest permissions exist and the role maps to a mobile home shell. */
export function canEnterAppHome(profile: AuthenticatedProfile | null | undefined): boolean {
  return resolveAppHomeHref(profile) !== null
}
