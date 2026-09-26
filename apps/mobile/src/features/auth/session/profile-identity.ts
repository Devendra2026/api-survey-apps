/**
 * Pure identity helpers for current-user profile loads.
 * Application identity is User.clerkUserId === Clerk userId (JWT sub).
 * Never compare Prisma User.id to Clerk userId.
 */

export function profileMatchesSession(
  profileClerkUserId: string,
  authUserId: string | null,
  tokenSubject: string | null
): boolean {
  if (authUserId && profileClerkUserId === authUserId) {
    return true
  }
  return Boolean(tokenSubject && profileClerkUserId === tokenSubject)
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
  if (input.requestId !== input.currentRequestId) {
    return false
  }
  if (!input.currentClerkUserId || !input.expectedClerkUserId) {
    return false
  }
  if (input.expectedClerkUserId !== input.currentClerkUserId) {
    return false
  }
  return input.profileClerkUserId === input.expectedClerkUserId
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
