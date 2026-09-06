/** Pad a numeric ward number for display (`1` → `01`). Non-numeric values kept as-is. */
function formatWardNumberDisplay(wardNumber: string | number): string {
  const raw = String(wardNumber ?? "").trim()
  if (!raw) return ""
  if (/^\d+$/.test(raw)) return String(Number.parseInt(raw, 10)).padStart(2, "0")
  return raw
}

/** Standard ward select option label: `{wardNumber} - {wardName}`. */
export function formatWardOptionLabel(ward: { wardNumber: string | number; wardName?: string | null }): string {
  const number = String(ward.wardNumber ?? "").trim()
  const name = (ward.wardName ?? "").trim()
  if (number && name) return `${number} - ${name}`
  if (number) return number
  if (name) return name
  return "Ward"
}

/** Command Center display label: `Ward No. 01 — Jatav Basti`. */
export function formatWardDisplayLabel(ward: { wardNumber: string | number; wardName?: string | null }): string {
  const number = formatWardNumberDisplay(ward.wardNumber)
  const name = (ward.wardName ?? "").trim()
  if (number && name) return `Ward No. ${number} — ${name}`
  if (number) return `Ward No. ${number}`
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
