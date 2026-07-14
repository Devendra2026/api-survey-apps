export interface TenantRoleAssignment {
  id: string
  roleId: string
  roleName: string
  /** Permissions granted by this specific role assignment */
  permissions: string[]
  stateId: string | null
  districtId: string | null
  ulbId: string | null
  wardId: string | null
  isActive: boolean
}

export interface AuthenticatedUser {
  id: string
  clerkUserId: string
  email: string
  fullName: string
  phone: string | null
  isActive: boolean
  /**
   * Union of permissions for backward-compatible route gates.
   * Prefer `userHasPermissionInTenant` for resource authorization.
   */
  permissions: string[]
  tenantRoles: TenantRoleAssignment[]
}

export interface TenantScope {
  /** True when user has at least one active role with all geo fields null (global). */
  isGlobal: boolean
  stateIds: string[]
  districtIds: string[]
  ulbIds: string[]
  wardIds: string[]
}

export type TenantGeo = {
  stateId?: string | null
  districtId?: string | null
  ulbId?: string | null
  wardId?: string | null
}
