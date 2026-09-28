import { normalizeEmail } from "../../users/pending-clerk-id.util.js"

type VerificationLike = { status?: string | null; strategy?: string | null } | null | undefined

export type ClerkEmailAddressLike = {
  id: string
  emailAddress: string
  verification?: VerificationLike
}

export type ClerkExternalAccountLike = {
  provider?: string | null
  identificationId?: string | null
  emailAddress?: string | null
  verification?: VerificationLike
}

export type ClerkUserEmailLike = {
  primaryEmailAddressId: string | null
  emailAddresses: ClerkEmailAddressLike[]
  externalAccounts?: ClerkExternalAccountLike[] | null
}

export type EmailVerificationResult = {
  email: string
  verified: boolean
  via: "email" | "oauth-strategy" | "oauth-account" | "none"
  primaryStatus: string
  primaryStrategy: string
  providers: string[]
}

const OAUTH_STRATEGY = /^(from_)?oauth_/
/** Statuses that never prove ownership, whatever the strategy. */
const UNPROVEN_STATUSES = new Set(["unverified", "failed", "expired"])

/**
 * Whether Clerk proved the session user owns their primary email.
 * Google sign-in proves ownership through the OAuth verification strategy on the email record
 * or through a verified oauth_* external account linked to that same address.
 */
export function resolveClerkEmailVerification(user: ClerkUserEmailLike): EmailVerificationResult {
  const primary =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0]
  const email = primary?.emailAddress ? normalizeEmail(primary.emailAddress) : ""
  const primaryStatus = primary?.verification?.status ?? "none"
  const primaryStrategy = primary?.verification?.strategy ?? "none"
  const oauthAccounts = (user.externalAccounts ?? []).filter((account) => OAUTH_STRATEGY.test(account.provider ?? ""))
  const providers = [...new Set(oauthAccounts.map((account) => account.provider ?? ""))].filter(Boolean).sort()
  const base = { email, primaryStatus, primaryStrategy, providers }

  if (!primary || !email) {
    return { ...base, verified: false, via: "none" }
  }
  if (primaryStatus === "verified") {
    return { ...base, verified: true, via: "email" }
  }
  if (OAUTH_STRATEGY.test(primaryStrategy) && !UNPROVEN_STATUSES.has(primaryStatus)) {
    return { ...base, verified: true, via: "oauth-strategy" }
  }
  const linkedVerifiedAccount = oauthAccounts.some((account) => {
    const linked =
      account.identificationId === primary.id ||
      (Boolean(account.emailAddress) && normalizeEmail(account.emailAddress ?? "") === email)
    // Clerk links an oauth_* account only after the provider flow completed; reject explicit failures.
    return linked && !UNPROVEN_STATUSES.has(account.verification?.status ?? "verified")
  })
  if (linkedVerifiedAccount) {
    return { ...base, verified: true, via: "oauth-account" }
  }
  return { ...base, verified: false, via: "none" }
}

export type ClerkKeyKind = "pk_test" | "pk_live" | "sk_test" | "sk_live" | "missing" | "unknown"

/** Key kind only (never the key) so environment mix-ups are visible in logs. */
export function clerkKeyKind(key: string | undefined | null): ClerkKeyKind {
  const trimmed = key?.trim() ?? ""
  if (!trimmed) return "missing"
  for (const kind of ["pk_test", "pk_live", "sk_test", "sk_live"] as const) {
    if (trimmed.startsWith(`${kind}_`)) return kind
  }
  return "unknown"
}

/** True when a publishable and a secret key come from different Clerk environments (test vs live). */
export function clerkKeysEnvironmentMismatch(publishable: ClerkKeyKind, secret: ClerkKeyKind): boolean {
  const env = (kind: ClerkKeyKind) => (kind.endsWith("_test") ? "test" : kind.endsWith("_live") ? "live" : null)
  const p = env(publishable)
  const s = env(secret)
  return p !== null && s !== null && p !== s
}
