"use client"

/**
 * Legacy accordion matrix — prefer PermissionMatrixTable for the enterprise dashboard.
 * Re-exports shared helpers for any remaining imports.
 */
export {
  rolePermissionIdSet,
  setsEqual,
  SYSTEM_ROLE_CODES as SYSTEM_ROLES,
} from "@/components/admin/roles/permission-utils"
export { PermissionMatrixTable as PermissionMatrix } from "@/components/admin/roles/permission-matrix-table"
export { MATRIX_MODULES as PERMISSION_MODULES } from "@/components/admin/roles/matrix-config"
