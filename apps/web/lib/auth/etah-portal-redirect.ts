const DEPARTMENT_ROLES = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])
const PLATFORM_STAY_ON_ADMIN = new Set(["ADMIN", "SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])

export type EtahRedirectRole = {
  isActive: boolean
  roleName?: string | null
  role?: { name?: string | null } | null
  district?: { name?: string | null } | null
}

export function etahPortalOrigin(): string {
  return (process.env.ETAH_PORTAL_URL ?? "https://portal.nppetah.in").replace(/\/$/, "")
}

export function isEtahDepartmentRole(role: EtahRedirectRole): boolean {
  if (!role.isActive) return false
  const name = role.role?.name ?? role.roleName ?? ""
  const district = role.district?.name?.toLowerCase() ?? ""
  return DEPARTMENT_ROLES.has(name) && district.includes("etah")
}

/** Etah department officers use portal.nppetah.in. Survey platform staff stay on admin. */
export function shouldRedirectToEtahPortal(tenantRoles: EtahRedirectRole[] | null | undefined): boolean {
  const active = (tenantRoles ?? []).filter((role) => role.isActive)
  const names = active.map((role) => role.role?.name ?? role.roleName ?? "")
  if (names.some((name) => PLATFORM_STAY_ON_ADMIN.has(name))) return false
  return active.some(isEtahDepartmentRole)
}
