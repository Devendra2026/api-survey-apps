import {
  MATRIX_ACTIONS,
  MATRIX_MODULES,
  type MatrixActionId,
  type MatrixModuleDef,
} from "@/components/admin/roles/matrix-config"
import { SYSTEM_ROLE_CODES } from "@/components/admin/roles/system-role-policy"

export { SYSTEM_ROLE_CODES }

export function rolePermissionIdSet(
  role?: {
    permissions?: Array<{
      permissionId?: string
      permission?: { id: string; name: string } | null
    }>
  } | null
): Set<string> {
  const ids = new Set<string>()
  for (const entry of role?.permissions ?? []) {
    const id = entry.permission?.id ?? entry.permissionId
    if (id) ids.add(id)
  }
  return ids
}

export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

export type CheckboxTriState = boolean | "indeterminate"

export const VIEW_REQUIRED_TOOLTIP = "View permission is required."

export type PermissionNameResolver = (permissionName: string) => { id: string; name: string } | undefined

/** Unique seeded permission IDs for a module row. */
export function modulePermissionIds(mod: MatrixModuleDef, resolve: PermissionNameResolver): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const action of MATRIX_ACTIONS) {
    const name = mod.cells[action.id]
    if (!name) continue
    const perm = resolve(name)
    if (perm && !seen.has(perm.id)) {
      seen.add(perm.id)
      ids.push(perm.id)
    }
  }
  return ids
}

export function checkState(selectedIds: Set<string>, ids: string[]): CheckboxTriState {
  if (!ids.length) return false
  const count = ids.filter((id) => selectedIds.has(id)).length
  if (count === 0) return false
  if (count === ids.length) return true
  return "indeterminate"
}

/** All unique permission IDs present in the matrix that resolve against the catalog. */
export function allMatrixPermissionIds(resolve: PermissionNameResolver): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const mod of MATRIX_MODULES) {
    for (const id of modulePermissionIds(mod, resolve)) {
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }
  return ids
}

/**
 * Count how many modules share a given permission ID (linked cells).
 */
export function sharedModuleCount(permissionId: string, resolve: PermissionNameResolver): number {
  let count = 0
  for (const mod of MATRIX_MODULES) {
    if (modulePermissionIds(mod, resolve).includes(permissionId)) count += 1
  }
  return count
}

export function moduleSummary(
  selectedIds: Set<string>,
  resolve: PermissionNameResolver
): Array<{ moduleId: string; label: string; granted: number; total: number }> {
  return MATRIX_MODULES.map((mod) => {
    const ids = modulePermissionIds(mod, resolve)
    return {
      moduleId: mod.id,
      label: mod.label,
      granted: ids.filter((id) => selectedIds.has(id)).length,
      total: ids.length,
    }
  }).filter((row) => row.total > 0)
}

/**
 * Toggle a cell with View dependency rules for the owning module row.
 * - Checking any non-view action auto-enables View (if the row has a View cell).
 * - Unchecking View removes every other permission in that row.
 * Shared permission IDs update globally (same Set).
 */
export function toggleCellWithDependencies(
  selectedIds: Set<string>,
  mod: MatrixModuleDef,
  actionId: MatrixActionId,
  permissionId: string,
  checked: boolean,
  resolve: PermissionNameResolver
): Set<string> {
  const next = new Set(selectedIds)
  const rowIds = modulePermissionIds(mod, resolve)
  const viewName = mod.cells.view
  const viewPerm = viewName ? resolve(viewName) : undefined

  if (checked) {
    next.add(permissionId)
    if (actionId !== "view" && viewPerm) {
      next.add(viewPerm.id)
    }
    return next
  }

  // Unchecking
  next.delete(permissionId)
  if (actionId === "view" && viewPerm && permissionId === viewPerm.id) {
    for (const id of rowIds) {
      if (id !== viewPerm.id) next.delete(id)
    }
  }
  return next
}

/** Select or clear all permissions in a module row (parent checkbox). */
export function setModuleRow(
  selectedIds: Set<string>,
  mod: MatrixModuleDef,
  checked: boolean,
  resolve: PermissionNameResolver
): Set<string> {
  const next = new Set(selectedIds)
  const ids = modulePermissionIds(mod, resolve)
  for (const id of ids) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

/**
 * Bulk set IDs. When checking, ensure each module's View is present for any
 * non-view grants that land in that row.
 */
export function setPermissionIds(
  selectedIds: Set<string>,
  ids: string[],
  checked: boolean,
  resolve: PermissionNameResolver
): Set<string> {
  const next = new Set(selectedIds)
  for (const id of ids) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  if (!checked) return next

  // Auto-add View for every module that has a non-view selection
  for (const mod of MATRIX_MODULES) {
    const viewName = mod.cells.view
    const viewPerm = viewName ? resolve(viewName) : undefined
    if (!viewPerm) continue
    const rowIds = modulePermissionIds(mod, resolve)
    const hasNonView = rowIds.some((id) => id !== viewPerm.id && next.has(id))
    if (hasNonView) next.add(viewPerm.id)
  }
  return next
}

/** True when unchecking View would strip other row permissions (for tooltip UX). */
export function isViewGateBlocked(
  mod: MatrixModuleDef,
  actionId: MatrixActionId,
  selectedIds: Set<string>,
  resolve: PermissionNameResolver
): boolean {
  if (actionId === "view") return false
  const viewName = mod.cells.view
  if (!viewName) return false
  const viewPerm = resolve(viewName)
  if (!viewPerm) return false
  return !selectedIds.has(viewPerm.id)
}
