/** Prefix for email-first imports before the user signs in with Clerk. */
export const PENDING_CLERK_ID_PREFIX = "pending:"

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function pendingClerkUserId(email: string): string {
  return `${PENDING_CLERK_ID_PREFIX}${normalizeEmail(email)}`
}

export function isPendingClerkUserId(clerkUserId: string): boolean {
  return clerkUserId.startsWith(PENDING_CLERK_ID_PREFIX)
}
