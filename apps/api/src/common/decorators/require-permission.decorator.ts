import { SetMetadata } from "@nestjs/common"

export const PERMISSIONS_KEY = "permissions"
export const ANY_PERMISSIONS_KEY = "any_permissions"

/** User must have every listed permission (AND). */
export const RequirePermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions)

/** User must have at least one listed permission (OR). */
export const RequireAnyPermission = (...permissions: string[]) => SetMetadata(ANY_PERMISSIONS_KEY, permissions)
