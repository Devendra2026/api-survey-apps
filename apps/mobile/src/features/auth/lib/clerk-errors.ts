import { isClerkAPIResponseError } from "@clerk/expo"
import { PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE } from "./sign-in-factors"

const CODE_MESSAGES: Record<string, string> = {
  form_identifier_not_found: "Invalid email or password.",
  form_password_incorrect: "Invalid email or password.",
  form_identifier_exists: "An account with this email already exists. Sign in instead.",
  form_password_pwned: "This password appears in a data breach. Choose a different password.",
  form_password_length_too_short: "Password is too short. Use at least 8 characters.",
  form_code_incorrect: "That verification code is incorrect. Check the email and try again.",
  form_password_validation_failed: "That password does not meet security requirements. Try a stronger password.",
  verification_expired: "That verification code has expired. Request a new code.",
  verification_failed: "Verification failed. Request a new code and try again.",
  session_exists: "You are already signed in on this device.",
  captcha_invalid: "Bot protection blocked this request. Ask an admin to check Clerk captcha settings for mobile.",
  captcha_missing_token:
    "Bot protection blocked this request. Ask an admin to check Clerk captcha settings for mobile.",
  /** Password (or other) strategy not valid for this Clerk user — typically Google-only accounts. */
  strategy_for_user_invalid: PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function messageForCode(code: string | undefined): string | null {
  if (!code) {
    return null
  }
  return CODE_MESSAGES[code] ?? null
}

function isNetworkLikeMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("offline")
  )
}

export function getClerkErrorMessage(error: unknown, fallback = "Authentication failed"): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0]
    if (__DEV__ && first?.code) {
      console.warn("[clerk-auth]", first.code, first.longMessage ?? first.message)
    }
    const fromCode = messageForCode(first?.code)
    if (fromCode) {
      return fromCode
    }
    // Clerk's human-readable copy for an invalid strategy — map without treating as wrong password.
    const strategyCopy = `${first?.longMessage ?? ""} ${first?.message ?? ""}`.toLowerCase()
    if (strategyCopy.includes("verification strategy is not valid")) {
      return PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE
    }
    if (first?.longMessage) {
      return first.longMessage
    }
    if (first?.message) {
      return first.message
    }
  }
  if (error instanceof Error && error.message) {
    if (isNetworkLikeMessage(error.message)) {
      return "Unable to connect. Please check your internet connection."
    }
    return error.message
  }
  return fallback
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
      return "This device must be verified. Enter the email code, or finish trust verification on the web admin once."
    }
    return "Sign-in could not be completed. Try again, or finish verification on the web admin."
  }
  if (normalized === "missing_requirements") {
    return "Sign-up is missing required fields. Complete your profile on the web, then sign in here."
  }
  return "Verification could not be completed. Request a new code or contact support."
}

export function getGoogleAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const lower = error.message.toLowerCase()
    if (
      lower.includes("cancel") ||
      lower.includes("dismiss") ||
      lower.includes("closed") ||
      lower.includes("user_cancelled") ||
      lower.includes("access_denied")
    ) {
      return "Google sign-in cancelled."
    }
    if (
      lower.includes("already linked") ||
      lower.includes("account linking") ||
      lower.includes("identifier already") ||
      lower.includes("external_account")
    ) {
      return "Your Google account is linked to a different application account. Sign in with the original account or contact your administrator."
    }
    if (isNetworkLikeMessage(error.message)) {
      return "No internet connection. Check your connection and try again."
    }
  }
  if (isClerkAPIResponseError(error)) {
    const code = error.errors[0]?.code
    if (code === "external_account_exists" || code === "identifier_already_signed_in") {
      return "Your Google account is linked to a different application account. Sign in with the original account or contact your administrator."
    }
  }
  return getClerkErrorMessage(error, "We could not complete Google sign-in. Please try again.")
}

export function validateRequestedRole(role: string | null | undefined): string | null {
  if (!role) {
    return "Select Surveyor or Supervisor."
  }
  if (role !== "SURVEYOR" && role !== "FIELD_SUPERVISOR") {
    return "Select Surveyor or Supervisor."
  }
  return null
}

export const MIN_PASSWORD_LENGTH = 8

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

export function validateSignInInput(email: string, password: string): string | null {
  if (!email.trim()) {
    return "Enter your email address."
  }
  if (!isValidEmail(email)) {
    return "Enter a valid email address."
  }
  if (!password) {
    return "Enter your password."
  }
  return null
}

export function validateSignUpInput(
  fullName: string,
  email: string,
  password: string,
  confirmPassword?: string
): string | null {
  if (!fullName.trim()) {
    return "Enter your full name."
  }
  if (!email.trim()) {
    return "Enter your email address."
  }
  if (!isValidEmail(email)) {
    return "Enter a valid email address."
  }
  if (!password) {
    return "Enter a password."
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return "Passwords do not match."
  }
  return null
}

export function validateResetEmail(email: string): string | null {
  if (!email.trim()) {
    return "Enter your email address."
  }
  if (!isValidEmail(email)) {
    return "Enter a valid email address."
  }
  return null
}
