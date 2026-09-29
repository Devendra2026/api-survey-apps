export const DEVICE_MUST_BE_VERIFIED_MESSAGE = "This device must be verified before you can continue."

export const ENTER_DEVICE_TRUST_CODE_MESSAGE = "Enter the verification code sent to your email."

export const INVALID_VERIFICATION_CODE_MESSAGE = "Invalid verification code. Please try again."

export const EXPIRED_VERIFICATION_CODE_MESSAGE = "Verification code expired. Request a new code."

export const UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE =
  "Google sign-in is not fully configured for this app build. Ask an administrator to allowlist the mobile SSO redirect URI in the Clerk Dashboard (Native applications)."

const PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE =
  "Password authentication is not available for this account. Try signing in with Google."

const CODE_MESSAGES: Record<string, string> = {
  form_identifier_not_found: "Invalid email or password.",
  form_password_incorrect: "Invalid email or password.",
  form_identifier_exists: "An account with this email already exists. Sign in instead.",
  form_password_pwned: "This password appears in a data breach. Choose a different password.",
  form_password_length_too_short: "Password is too short. Use at least 8 characters.",
  form_code_incorrect: INVALID_VERIFICATION_CODE_MESSAGE,
  form_password_validation_failed: "That password does not meet security requirements. Try a stronger password.",
  verification_expired: EXPIRED_VERIFICATION_CODE_MESSAGE,
  verification_failed: "Verification failed. Request a new code and try again.",
  session_exists: "You are already signed in on this device.",
  captcha_invalid: "Bot protection blocked this request. Ask an admin to check Clerk captcha settings for mobile.",
  captcha_missing_token:
    "Bot protection blocked this request. Ask an admin to check Clerk captcha settings for mobile.",
  strategy_for_user_invalid: PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE,
  resource_missmatch: UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE,
  redirect_uri_mismatch: UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE,
}

export function messageForClerkCode(code: string | undefined): string | null {
  if (!code) {
    return null
  }
  return CODE_MESSAGES[code] ?? null
}

/** True when Clerk rejected the native SSO redirect URI as unauthorized. */
export function isUnauthorizedNativeRedirectMessage(message: string | undefined): boolean {
  if (!message) {
    return false
  }
  const lower = message.toLowerCase()
  return (
    lower.includes("authorized redirect") ||
    lower.includes("redirect uri") ||
    lower.includes("redirect url") ||
    (lower.includes("redirect") && lower.includes("does not match"))
  )
}

export function incompleteAuthMessage(kind: "sign_in" | "sign_up", status: string | null | undefined): string {
  const normalized = status?.trim() || "unknown"
  if (kind === "sign_in") {
    if (normalized === "needs_second_factor") {
      return "Additional verification is required. Enter the code we sent to your email."
    }
    if (normalized === "needs_first_factor") {
      return "Additional verification is required to complete sign-in."
    }
    if (normalized === "needs_client_trust") {
      return `${DEVICE_MUST_BE_VERIFIED_MESSAGE} ${ENTER_DEVICE_TRUST_CODE_MESSAGE}`
    }
    return "Sign-in could not be completed. Try again, or finish verification on the web admin."
  }
  if (normalized === "missing_requirements") {
    return "Sign-up is missing required fields. Complete your profile on the web, then sign in here."
  }
  return "Verification could not be completed. Request a new code or contact support."
}

/**
 * Seconds until Clerk allows another verification send.
 * Uses `retryAfter` from ClerkAPIResponseError (or the future-API error's cause). Never invents a default.
 */
export function extractClerkRetryAfterSeconds(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "retryAfter" in error) {
    const retryAfter = (error as { retryAfter?: unknown }).retryAfter
    if (typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.ceil(retryAfter)
    }
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    (error as { cause?: unknown }).cause !== undefined
  ) {
    return extractClerkRetryAfterSeconds((error as { cause: unknown }).cause)
  }
  return null
}
