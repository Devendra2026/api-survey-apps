/**
 * Pure helpers for Clerk custom sign-in factor selection.
 * Used by email/password and forgot-password flows before calling password strategies.
 */

export type SignInFactorLike = {
  strategy: string
  emailAddressId?: string
  phoneNumberId?: string
  safeIdentifier?: string
}

export const PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE =
  "Password authentication is not available for this account. Try signing in with Google."

export const PASSWORD_RESET_UNAVAILABLE_GOOGLE_MESSAGE =
  "Password reset is not available for this account. Try signing in with Google."

export function hasPasswordFactor(factors: SignInFactorLike[] | null | undefined): boolean {
  return (factors ?? []).some((factor) => factor.strategy === "password")
}

export function hasGoogleOAuthFactor(factors: SignInFactorLike[] | null | undefined): boolean {
  return (factors ?? []).some((factor) => factor.strategy === "oauth_google")
}

export function findEmailCodeFactor(factors: SignInFactorLike[] | null | undefined): SignInFactorLike | undefined {
  return (factors ?? []).find((factor) => factor.strategy === "email_code")
}

export function findTotpFactor(factors: SignInFactorLike[] | null | undefined): SignInFactorLike | undefined {
  return (factors ?? []).find((factor) => factor.strategy === "totp")
}

export function findPhoneCodeFactor(factors: SignInFactorLike[] | null | undefined): SignInFactorLike | undefined {
  return (factors ?? []).find((factor) => factor.strategy === "phone_code")
}

/**
 * Message when password cannot be used for this identifier.
 * Prefer Google when Clerk lists oauth_google; otherwise list strategies Clerk returned.
 */
export function passwordUnavailableMessage(factors: SignInFactorLike[] | null | undefined): string {
  if (hasGoogleOAuthFactor(factors)) {
    return PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE
  }
  const strategies = [...new Set((factors ?? []).map((factor) => factor.strategy).filter(Boolean))]
  if (strategies.length === 0) {
    return "Password authentication is not available for this account. Try Continue with Google, or finish sign-up on the web."
  }
  return `Password authentication is not available for this account. Available methods: ${strategies.join(", ")}.`
}

export function passwordResetUnavailableMessage(factors: SignInFactorLike[] | null | undefined): string {
  if (hasGoogleOAuthFactor(factors)) {
    return PASSWORD_RESET_UNAVAILABLE_GOOGLE_MESSAGE
  }
  const strategies = [...new Set((factors ?? []).map((factor) => factor.strategy).filter(Boolean))]
  if (strategies.length === 0) {
    return "Password reset is not available for this account. Try signing in with Google."
  }
  return `Password reset is not available for this account. Available methods: ${strategies.join(", ")}.`
}

export function unsupportedSecondFactorMessage(factors: SignInFactorLike[] | null | undefined): string {
  const strategies = [...new Set((factors ?? []).map((factor) => factor.strategy).filter(Boolean))]
  if (strategies.includes("totp")) {
    return "This account requires an authenticator app code. Open your authenticator app, or finish sign-in on the web admin once, then return here."
  }
  if (strategies.includes("phone_code")) {
    return "This account requires SMS verification. Finish the SMS step on the web admin once, then return here — or contact an administrator."
  }
  if (strategies.length === 0) {
    return "Additional verification is required. Finish sign-in on the web admin once, then return here."
  }
  return `Additional verification is required (${strategies.join(", ")}). Finish that step on the web admin once, then return here.`
}
