/** Standard ward select option label: `{wardNumber} - {wardName}`. */
export function formatWardOptionLabel(ward: { wardNumber: string | number; wardName?: string | null }): string {
  const number = String(ward.wardNumber ?? "").trim()
  const name = (ward.wardName ?? "").trim()
  if (number && name) return `${number} - ${name}`
  if (number) return number
  if (name) return name
  return "Ward"
}

/** True when any active tenant role is named ADMIN. */
export function hasAdminRole(
  tenantRoles: Array<{ isActive?: boolean; roleName?: string; role?: { name?: string } | null }> | null | undefined
): boolean {
  if (!tenantRoles?.length) return false
  return tenantRoles.some((role) => {
    if (role.isActive === false) return false
    const name = role.role?.name ?? role.roleName
    return name === "ADMIN"
  })
}
