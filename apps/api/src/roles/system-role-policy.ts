/**
 * System vs custom role policy for NestJS RBAC.
 * Mirrors apps/web/components/admin/roles/system-role-policy.ts
 */

/** Seeded roles that cannot be renamed or deleted. */
export const SYSTEM_ROLE_NAMES = new Set(["PENDING_APPROVAL", "SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR", "ADMIN"])

/**
 * System roles that may gain permissions but must keep their seeded baseline.
 * ADMIN / PENDING_APPROVAL remain fully locked (no permission matrix edits).
 */
export const ADD_ONLY_SYSTEM_ROLES = new Set(["SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])

/** Seeded baseline permission names per system role (must not be removed). */
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
  ADMIN: [], // fully locked — handled separately
}

export function isSystemRole(roleName: string): boolean {
  return SYSTEM_ROLE_NAMES.has(roleName)
}

export function canModifyPermissions(roleName: string): boolean {
  if (!isSystemRole(roleName)) return true
  return ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function isFullyLockedSystemRole(roleName: string): boolean {
  return isSystemRole(roleName) && !ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function protectedPermissionNames(roleName: string): ReadonlySet<string> {
  if (!isSystemRole(roleName)) return new Set()
  const baseline = SYSTEM_ROLE_BASELINE[roleName]
  return new Set(baseline ?? [])
}

/**
 * Validates a proposed permission name set against system-role policy.
 * @returns error message or null if OK
 */
export function validatePermissionChange(roleName: string, nextPermissionNames: ReadonlySet<string>): string | null {
  if (isFullyLockedSystemRole(roleName)) {
    return "System role permissions cannot be modified"
  }
  if (!isSystemRole(roleName)) return null

  const protectedNames = protectedPermissionNames(roleName)
  for (const name of protectedNames) {
    if (!nextPermissionNames.has(name)) {
      return `Cannot remove protected system permission "${name}" from ${roleName}`
    }
  }
  return null
}
