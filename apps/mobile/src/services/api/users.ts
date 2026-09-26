import { apiGet, apiPost, apiRequest } from "@/services/api/client"
import type { AuthenticatedProfile } from "@/types/user"

export type SyncUserInput = {
  fullName?: string
  phone?: string
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
}

/**
 * Load the authenticated application profile.
 * Pass `bearerToken` from the same Clerk getToken() used for identity checks
 * so the API client does not fetch a second (possibly different) token.
 */
export function getMe(bearerToken?: string): Promise<AuthenticatedProfile> {
  if (bearerToken) {
    return apiRequest<AuthenticatedProfile>("/users/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
  }
  return apiGet<AuthenticatedProfile>("/users/me")
}

export function syncUser(input: SyncUserInput): Promise<SyncedUserFields> {
  return apiPost<SyncedUserFields>("/users/sync", input)
}
