/**
 * Central auth surface for the mobile app.
 * Session state lives in AppSessionProvider; Clerk owns identity.
 */

export { AppSessionProvider, useAppSession } from "@/features/auth/AppSessionProvider";
export type { AppSessionState } from "@/features/auth/AppSessionProvider";
export { AuthTokenBridge } from "@/features/auth/AuthTokenBridge";
export { getClerkErrorMessage } from "@/features/auth/clerk-errors";
export { tokenCache } from "@clerk/clerk-expo/token-cache";
