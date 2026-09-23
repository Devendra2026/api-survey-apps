import { isClerkAPIResponseError } from "@clerk/clerk-expo";

export function getClerkErrorMessage(error: unknown, fallback = "Authentication failed"): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    if (first?.longMessage) {
      return first.longMessage;
    }
    if (first?.message) {
      return first.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
