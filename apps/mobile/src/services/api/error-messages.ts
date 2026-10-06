/**
 * Maps HTTP status + Nest envelope message to a safe user-facing string.
 * Prefer the server message when Nest already returned actionable copy (e.g. schema drift).
 */
export function friendlyHttpMessage(statusCode: number, serverMessage: string): string {
  const trimmed = serverMessage.trim()

  switch (statusCode) {
    case 401:
      return trimmed || "Your session expired or the account is not allowed."
    case 403:
      return trimmed || "You do not have permission for this action."
    case 404:
      return trimmed || "The requested resource was not found."
    case 409:
      return trimmed || "This request conflicts with existing data."
    case 413:
      return trimmed || "This file is too large. Choose a smaller photo and try again."
    case 422:
      return trimmed || "Please check the form and try again."
    case 429:
      return "Too many requests. Please wait a moment and try again."
    case 500:
      // Nest often returns actionable messages (schema behind API, Prisma, etc.).
      return trimmed || "The server encountered an error. Please try again, or contact an administrator."
    case 502:
    case 503:
    case 504:
      return trimmed || "The server is temporarily unavailable. Please try again."
    default:
      return trimmed || `Request failed (${statusCode})`
  }
}

export function profileLoadUserMessage(error: {
  kind: "http" | "network" | "timeout" | "parse" | "config"
  statusCode: number
  message: string
}): string {
  if (error.kind === "config") {
    return error.message || "This build is missing a valid API URL. Contact an administrator."
  }
  if (error.kind === "network") {
    return "Unable to reach the server. Check your connection and API URL, then try again."
  }
  if (error.kind === "timeout") {
    return "The request timed out. Check your connection and try again."
  }
  if (error.kind === "parse") {
    return error.message || "Your account profile could not be loaded. Please try again."
  }
  if (error.statusCode === 401) {
    return error.message || "Your session has expired. Please sign in again."
  }
  if (error.statusCode === 403) {
    return error.message || "You are signed in but not allowed to access this application yet."
  }
  if (error.statusCode === 404) {
    return "Your account is authenticated, but your application profile is not available. Contact an administrator."
  }
  if (error.statusCode === 409) {
    return (
      error.message ||
      "Your authentication identity conflicts with an existing application account. Contact an administrator."
    )
  }
  return error.message || "Your account profile could not be loaded. Please try again."
}
