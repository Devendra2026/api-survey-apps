/**
 * View-dependency rules for RBAC permission sets.
 * Convention: `resource:action` (action !== "view") requires `resource:view`
 * when that view permission exists in the permission catalog.
 *
 * Mirrors the enterprise matrix rule: Create/Edit/Delete/… require View.
 */

const VIEW_SUFFIX = ":view"

/** Returns the view permission name required by `permissionName`, or null if none. */
export function requiredViewPermission(permissionName: string): string | null {
  const colon = permissionName.indexOf(":")
  if (colon <= 0) return null
  const action = permissionName.slice(colon + 1)
  if (!action || action === "view") return null
  return `${permissionName.slice(0, colon)}${VIEW_SUFFIX}`
}

/**
 * Validates that every non-view permission in `names` has its matching view
 * permission also present, when that view permission exists in the catalog.
 *
 * @param names - Permission names being granted
 * @param catalogNames - All known permission names (from DB). If omitted, any
 *   derived `resource:view` is treated as required.
 */
export function validateViewDependencies(names: string[], catalogNames?: ReadonlySet<string>): string | null {
  const set = new Set(names)
  for (const name of names) {
    const required = requiredViewPermission(name)
    if (!required) continue
    if (catalogNames && !catalogNames.has(required)) continue
    if (!set.has(required)) {
      return `Permission "${name}" requires "${required}" (View is mandatory)`
    }
  }
  return null
}
