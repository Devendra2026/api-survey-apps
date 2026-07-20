/**
 * System vs custom role policy for the Roles & Permissions UI.
 * Keep in sync with apps/api/src/roles/system-role-policy.ts
 */

export const SYSTEM_ROLE_CODES = new Set(["PENDING_APPROVAL", "SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR", "ADMIN"])

/** System roles that may add permissions but cannot remove seeded baseline. */
export const ADD_ONLY_SYSTEM_ROLES = new Set(["SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])

export const SYSTEM_ROLE_BASELINE: Record<string, readonly string[]> = {
  PENDING_APPROVAL: [],
  SURVEYOR: [
    "survey:create",
    "survey:update",
    "survey:view",
    "survey:submit",
    "photo:create",
    "photo:update",
    "photo:delete",
    "dashboard:view",
  ],
  FIELD_SUPERVISOR: [
    "survey:create",
    "survey:update",
    "survey:view",
    "survey:submit",
    "survey:assign",
    "survey:reject",
    "photo:create",
    "photo:update",
    "photo:delete",
    "user:view",
    "dashboard:view",
    "report:view",
  ],
  QC_SUPERVISOR: [
    "survey:view",
    "survey:update",
    "survey:approve",
    "survey:reject",
    "photo:update",
    "photo:delete",
    "user:view",
    "dashboard:view",
    "report:view",
  ],
  ADMIN: [],
}

export type RoleCategory = "SYSTEM" | "CUSTOM"

export function isSystemRole(roleName: string): boolean {
  return SYSTEM_ROLE_CODES.has(roleName)
}

export function roleCategory(roleName: string): RoleCategory {
  return isSystemRole(roleName) ? "SYSTEM" : "CUSTOM"
}

export function canModifyPermissions(roleName: string): boolean {
  if (!isSystemRole(roleName)) return true
  return ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function isFullyLockedSystemRole(roleName: string): boolean {
  return isSystemRole(roleName) && !ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function canRenameRole(roleName: string): boolean {
  return !isSystemRole(roleName)
}

export function canDeleteRole(roleName: string): boolean {
  return !isSystemRole(roleName)
}

export function protectedPermissionNames(roleName: string): ReadonlySet<string> {
  if (!isSystemRole(roleName)) return new Set()
  return new Set(SYSTEM_ROLE_BASELINE[roleName] ?? [])
}

/**
 * Resolve protected permission IDs from catalog names.
 */
export function protectedPermissionIds(roleName: string, catalog: Array<{ id: string; name: string }>): Set<string> {
  const names = protectedPermissionNames(roleName)
  const ids = new Set<string>()
  for (const p of catalog) {
    if (names.has(p.name)) ids.add(p.id)
  }
  return ids
}
