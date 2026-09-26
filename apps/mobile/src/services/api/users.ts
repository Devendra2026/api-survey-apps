import { apiGet, apiPost } from "@/services/api/client"
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

export function getMe(): Promise<AuthenticatedProfile> {
  return apiGet<AuthenticatedProfile>("/users/me")
}

export function syncUser(input: SyncUserInput): Promise<SyncedUserFields> {
  return apiPost<SyncedUserFields>("/users/sync", input)
}
