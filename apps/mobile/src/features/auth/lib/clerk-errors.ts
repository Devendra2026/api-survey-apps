import { isClerkAPIResponseError } from "@clerk/expo"
import {
  extractClerkRetryAfterSeconds,
  incompleteAuthMessage,
  isUnauthorizedNativeRedirectMessage,
  messageForClerkCode,
  UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE,
} from "./clerk-auth-copy"
import { PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE } from "./sign-in-factors"

export { extractClerkRetryAfterSeconds, incompleteAuthMessage }

type ClerkErrorLike = {
  clerkError: true
  code: string
  message: string
  longMessage?: string
  cause?: unknown
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function isClerkErrorLike(error: unknown): error is ClerkErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "clerkError" in error &&
    (error as { clerkError: unknown }).clerkError === true &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  )
}

function messageFromClerkCodeAndCopy(code: string | undefined, message?: string, longMessage?: string): string | null {
  const fromCode = messageForClerkCode(code)
  if (fromCode) {
    return fromCode
  }
  const strategyCopy = `${longMessage ?? ""} ${message ?? ""}`.toLowerCase()
  if (strategyCopy.includes("verification strategy is not valid")) {
    return PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE
  }
  if (isUnauthorizedNativeRedirectMessage(longMessage) || isUnauthorizedNativeRedirectMessage(message)) {
    return UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE
  }
  if (longMessage) {
    return longMessage
  }
  if (message) {
    return message
  }
  return null
}

/**
 * Maps Clerk future-API `{ error }` values (ClerkError) and thrown API errors to user-safe copy.
 */
export function getClerkErrorMessage(error: unknown, fallback = "Authentication failed"): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0]
    if (__DEV__ && first?.code) {
      console.warn("[clerk-auth]", first.code, first.longMessage ?? first.message)
    }
    const mapped = messageFromClerkCodeAndCopy(first?.code, first?.message, first?.longMessage)
    if (mapped) {
      return mapped
    }
  }
  if (isClerkErrorLike(error)) {
    if (__DEV__) {
      console.warn("[clerk-auth]", error.code, error.longMessage ?? error.message)
    }
    const mapped = messageFromClerkCodeAndCopy(error.code, error.message, error.longMessage)
    if (mapped) {
      return mapped
    }
    if (error.cause) {
      return getClerkErrorMessage(error.cause, fallback)
    }
  }
  if (error instanceof Error && error.message) {
    if (isNetworkLikeMessage(error.message)) {
      return "Unable to connect. Please check your internet connection."
    }
    if (isUnauthorizedNativeRedirectMessage(error.message)) {
      return UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE
    }
    return error.message
  }
  return fallback
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
    if (isUnauthorizedNativeRedirectMessage(error.message)) {
      return UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE
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
    const first = error.errors[0]
    if (
      isUnauthorizedNativeRedirectMessage(first?.longMessage) ||
      isUnauthorizedNativeRedirectMessage(first?.message)
    ) {
      return UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE
    }
    const code = first?.code
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
