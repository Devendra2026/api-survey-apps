import type { RequestableRole } from "@/types/user"

/**
 * Holds signup role intent across email verification / Google SSO until
 * POST /users/sync can persist User.requestedRole. Cleared after successful sync
 * or on explicit reset (sign-out).
 */
let pendingRequestedRole: RequestableRole | null = null

export function setSignupRequestedRole(role: RequestableRole | null): void {
  pendingRequestedRole = role
}

export function peekSignupRequestedRole(): RequestableRole | null {
  return pendingRequestedRole
}

/** Returns and clears the staged role (call after a successful sync). */
export function consumeSignupRequestedRole(): RequestableRole | null {
  const role = pendingRequestedRole
  pendingRequestedRole = null
  return role
}

export function clearSignupRequestedRole(): void {
  pendingRequestedRole = null
}
