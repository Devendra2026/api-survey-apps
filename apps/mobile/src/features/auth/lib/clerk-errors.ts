import { isClerkAPIResponseError } from "@clerk/expo"

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
    if (normalized === "needs_first_factor" || normalized === "needs_second_factor") {
      return "Your account requires additional verification. Complete sign-in on the web admin, then return here."
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
      return "Google sign-in was cancelled."
    }
    if (isNetworkLikeMessage(error.message)) {
      return "Unable to connect. Please check your internet connection."
    }
  }
  return getClerkErrorMessage(error, "Google sign-in failed")
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
