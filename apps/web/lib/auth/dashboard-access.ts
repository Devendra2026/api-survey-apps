export function hasDashboardAccess(permissions: string[] | null | undefined): boolean {
  return Array.isArray(permissions) && permissions.length > 0
}
