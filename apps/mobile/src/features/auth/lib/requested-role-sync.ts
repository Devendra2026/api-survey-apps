import { canEnterAppHome, type AuthenticatedProfile, type RequestableRole } from "../../../types/user.ts"

/**
 * Role to send on POST /users/sync for the signed-in user.
 * Pending, active accounts may set or replace signup intent.
 * Onboarded and inactive accounts are left unchanged.
 */
export function requestedRoleToSync(
  profile: AuthenticatedProfile,
  stagedRole: RequestableRole | null
): RequestableRole | undefined {
  if (!stagedRole || !profile.isActive || canEnterAppHome(profile)) {
    return undefined
  }
  if (profile.requestedRole === stagedRole) {
    return undefined
  }
  return stagedRole
}
