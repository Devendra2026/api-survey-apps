/**
 * Pure identity helpers for current-user profile loads.
 * Application identity is User.clerkUserId === Clerk userId (JWT sub).
 * Never compare Prisma User.id to Clerk userId.
 */

export const SESSION_MESSAGES = {
  sessionExpired: "Authentication session expired. Please sign in again.",
  profileUnavailable: "Your account profile could not be loaded. Please try again.",
  identityRefreshing: "Your authentication session and application profile do not match. Refreshing your profile...",
  identityMismatch:
    "Your authentication session and application profile do not match. Sign out and sign in again, or contact an administrator.",
} as const

/**
 * The current Clerk userId is authoritative. A profile matches only when its clerkUserId equals it,
 * and the bearer used to load it (JWT sub) belongs to the same Clerk user.
 */
export function profileMatchesSession(
  profileClerkUserId: string,
  authUserId: string | null,
  tokenSubject: string | null
): boolean {
  if (!authUserId || profileClerkUserId !== authUserId) {
    return false
  }
  return !tokenSubject || tokenSubject === authUserId
}

/**
 * A /users/me response is stale when a newer fetch started, the user signed out,
 * or Clerk switched to a different user while the request was in flight.
 */
export function isProfileRequestCurrent(input: {
  requestId: number
  currentRequestId: number
  expectedClerkUserId: string | null
  currentClerkUserId: string | null
}): boolean {
  return (
    input.requestId === input.currentRequestId &&
    Boolean(input.expectedClerkUserId) &&
    input.expectedClerkUserId === input.currentClerkUserId
  )
}

/** Cache key for the current-user profile. Always scoped by Clerk userId. */
export function profileCacheKey(clerkUserId: string): string {
  return `profile:${clerkUserId}`
}

export type IdentityDiagnostics = {
  clerkUserId: string | null
  authenticatedUserId: string | null
  databaseUserId: string | null
  databaseClerkUserId: string | null
  profileClerkUserId: string | null
  role: string | null
  status: string | null
  assignmentIds: string[]
  cacheKey: string | null
  navigationState: string
}

/** Log-safe identity snapshot: ids, role and status only. Never tokens, secrets, or credentials. */
export function formatIdentityDiagnostics(d: IdentityDiagnostics): string {
  return [
    `clerkUserId=${d.clerkUserId ?? "none"}`,
    `authenticatedUserId=${d.authenticatedUserId ?? "none"}`,
    `databaseUserId=${d.databaseUserId ?? "none"}`,
    `databaseClerkUserId=${d.databaseClerkUserId ?? "none"}`,
    `profileClerkUserId=${d.profileClerkUserId ?? "none"}`,
    `role=${d.role ?? "none"}`,
    `status=${d.status ?? "none"}`,
    `assignmentIds=${d.assignmentIds.length > 0 ? d.assignmentIds.join(",") : "none"}`,
    `cacheKey=${d.cacheKey ?? "none"}`,
    `navigationState=${d.navigationState}`,
  ].join(" ")
}

/**
 * Drop a late /users/me response when the signed-in Clerk user changed
 * or the request generation was invalidated (logout / newer fetch).
 */
export function shouldCommitProfileResponse(input: {
  requestId: number
  currentRequestId: number
  expectedClerkUserId: string | null
  currentClerkUserId: string | null
  profileClerkUserId: string
}): boolean {
  return isProfileRequestCurrent(input) && input.profileClerkUserId === input.expectedClerkUserId
}

export function readJwtSubject(token: string): string | null {
  const segment = token.split(".")[1]
  if (!segment) {
    return null
  }
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/")
    const parsed: unknown = JSON.parse(globalThis.atob(padded))
    if (typeof parsed === "object" && parsed !== null && "sub" in parsed && typeof parsed.sub === "string") {
      return parsed.sub
    }
    return null
  } catch {
    return null
  }
}

/**
 * After Google/SSO setActive, Clerk hooks may expose the new userId before
 * getToken() rotates off the previous JWT. Treat that as a transient race,
 * not a permanent identity mismatch.
 */
export function isTransientTokenUserMismatch(expectedClerkUserId: string, tokenSubject: string | null): boolean {
  return Boolean(tokenSubject && tokenSubject !== expectedClerkUserId)
}

/**
 * 401 from /users/me must not force Clerk sign-out except for disabled accounts
 * (handled separately). Auto-sign-out after Google SSO made successful sessions
 * bounce back to the login screen with no usable error.
 */
export function shouldAutoSignOutOnProfile401(message: string): boolean {
  if (/disabled/i.test(message)) {
    return false
  }
  // Business / account-resolution failures: keep the Clerk session so the user
  // can read the error and choose Sign out.
  if (/already linked to a different Clerk account/i.test(message)) {
    return false
  }
  if (/unable to resolve your account profile/i.test(message)) {
    return false
  }
  // Default: do not auto-sign-out. Retry / Sign out remain available.
  return false
}

/** Prefer top-level SSO session id, then sign-in / sign-up created session. */
export function resolveSsoSessionId(input: {
  createdSessionId?: string | null
  signInCreatedSessionId?: string | null
  signUpCreatedSessionId?: string | null
}): string | null {
  return (
    input.createdSessionId?.trim() ||
    input.signInCreatedSessionId?.trim() ||
    input.signUpCreatedSessionId?.trim() ||
    null
  )
}
