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
 * @deprecated Full edit is allowed for all roles; retained for baseline reference / future Refresh RBAC.
 */
export const ADD_ONLY_SYSTEM_ROLES = new Set<string>()

/** Seeded baseline permission names per system role (informational; not enforced on save). */
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
  void roleName
  return true
}

export function isFullyLockedSystemRole(roleName: string): boolean {
  void roleName
  return false
}

export function protectedPermissionNames(roleName: string): ReadonlySet<string> {
  void roleName
  return new Set()
}

/**
 * Validates a proposed permission name set against system-role policy.
 * Full edit is allowed for all roles (including system).
 * @returns error message or null if OK
 */
export function validatePermissionChange(roleName: string, nextPermissionNames: ReadonlySet<string>): string | null {
  void roleName
  void nextPermissionNames
  return null
}
