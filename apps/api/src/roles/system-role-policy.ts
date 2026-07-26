/**
 * System vs custom role policy for NestJS RBAC.
 * Mirrors apps/web/components/admin/roles/system-role-policy.ts
 */

/** Seeded roles that cannot be renamed or deleted. */
export const SYSTEM_ROLE_NAMES = new Set([
  "PENDING_APPROVAL",
  "SURVEYOR",
  "FIELD_SUPERVISOR",
  "QC_SUPERVISOR",
  "ADMIN",
  "DEPT_ADMIN",
  "DEPT_CLERK",
  "DEPT_OPERATOR",
])

export const DEPARTMENT_ROLE_NAMES = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])

export const PLATFORM_ROLE_NAMES = new Set([
  "PENDING_APPROVAL",
  "SURVEYOR",
  "FIELD_SUPERVISOR",
  "QC_SUPERVISOR",
  "ADMIN",
])

/**
 * System roles that may gain permissions but must keep their seeded baseline.
 * ADMIN / PENDING_APPROVAL remain fully locked (no permission matrix edits).
 * Department roles are fully editable by platform admins (SDV-owned template).
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
  ADMIN: [],
  DEPT_ADMIN: [
    "user:view",
    "user:create",
    "user:update",
    "role:assign",
    "dashboard:view",
    "survey:view",
    "report:view",
    "report:export",
  ],
  DEPT_CLERK: ["user:view", "survey:view", "survey:update", "report:view", "dashboard:view"],
  DEPT_OPERATOR: ["survey:create", "survey:submit", "survey:view", "photo:create", "dashboard:view"],
}

export function isDepartmentRole(roleName: string): boolean {
  return DEPARTMENT_ROLE_NAMES.has(roleName)
}

export function isSystemRole(roleName: string): boolean {
  return SYSTEM_ROLE_NAMES.has(roleName)
}

export function canModifyPermissions(roleName: string): boolean {
  // SDV owns the municipal template — full matrix edits allowed
  if (isDepartmentRole(roleName)) return true
  if (!isSystemRole(roleName)) return true
  return ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function isFullyLockedSystemRole(roleName: string): boolean {
  if (isDepartmentRole(roleName)) return false
  return isSystemRole(roleName) && !ADD_ONLY_SYSTEM_ROLES.has(roleName)
}

export function protectedPermissionNames(roleName: string): ReadonlySet<string> {
  if (!isSystemRole(roleName) || isDepartmentRole(roleName)) return new Set()
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
  if (!isSystemRole(roleName) || isDepartmentRole(roleName)) return null

  const protectedNames = protectedPermissionNames(roleName)
  for (const name of protectedNames) {
    if (!nextPermissionNames.has(name)) {
      return `Cannot remove protected system permission "${name}" from ${roleName}`
    }
  }
  return null
}
