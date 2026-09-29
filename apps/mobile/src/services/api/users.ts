import { ApiClientError, apiGet, apiPost, apiRequest } from "@/services/api/client"
import { isAuthenticatedProfile, type AuthenticatedProfile } from "@/types/user"

export type SyncUserInput = {
  fullName?: string
  phone?: string
  requestedRole?: "SURVEYOR" | "FIELD_SUPERVISOR"
}

/** Bare user fields returned by POST /users/sync (no permissions / roles). */
export type SyncedUserFields = {
  id: string
  clerkUserId: string
  email: string
  phone?: string | null
  fullName: string
  isActive: boolean
  lastLoginAt?: string | null
  requestedRole?: string | null
}

/**
 * Load the authenticated application profile.
 * Pass `bearerToken` from the same Clerk getToken() used for identity checks
 * so the API client does not fetch a second (possibly different) token.
 */
export async function getMe(bearerToken?: string): Promise<AuthenticatedProfile> {
  const body = bearerToken
    ? await apiRequest<unknown>("/users/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${bearerToken}` },
      })
    : await apiGet<unknown>("/users/me")
  if (!isAuthenticatedProfile(body)) {
    throw new ApiClientError("Your account profile could not be loaded. Please try again.", 0, null, "parse")
  }
  return body
}

export function syncUser(input: SyncUserInput): Promise<SyncedUserFields> {
  return apiPost<SyncedUserFields>("/users/sync", input)
}
