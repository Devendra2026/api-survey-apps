import { isClerkAPIResponseError } from "@clerk/expo"

const CODE_MESSAGES: Record<string, string> = {
  form_identifier_not_found: "No account found with that email. Sign up first, or check the address.",
  form_password_incorrect: "Incorrect password. Try again, or use Forgot password.",
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
}

function messageForCode(code: string | undefined): string | null {
  if (!code) {
    return null
  }
  return CODE_MESSAGES[code] ?? null
}

export function getClerkErrorMessage(error: unknown, fallback = "Authentication failed"): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0]
    const fromCode = messageForCode(first?.code)
    if (fromCode) {
      return fromCode
    }
    if (first?.longMessage) {
      return first.longMessage
    }
    if (first?.message) {
      return first.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function incompleteAuthMessage(kind: "sign_in" | "sign_up", status: string | null | undefined): string {
  const normalized = status?.trim() || "unknown"
  if (kind === "sign_in") {
    if (normalized === "needs_first_factor" || normalized === "needs_second_factor") {
      return "Additional verification is required for this account. Complete sign-in on the web admin, then return here."
    }
    return `Sign-in is incomplete (status: ${normalized}). Try again, or complete verification on the web.`
  }
  if (normalized === "missing_requirements") {
    return "Sign-up is missing required fields. Complete your profile on the web, then sign in here."
  }
  return `Verification is incomplete (status: ${normalized}). Request a new code or contact support.`
}

export const MIN_PASSWORD_LENGTH = 8

export function validateSignInInput(email: string, password: string): string | null {
  if (!email.trim()) {
    return "Enter your email address."
  }
  if (!password) {
    return "Enter your password."
  }
  return null
}

export function validateSignUpInput(fullName: string, email: string, password: string): string | null {
  if (!fullName.trim()) {
    return "Enter your full name."
  }
  if (!email.trim()) {
    return "Enter your email address."
  }
  if (!password) {
    return "Enter a password."
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}
