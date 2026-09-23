/**
 * Central auth surface for the mobile app.
 *
 * Option A leaves Clerk unwired. When auth is added:
 * - Install `@clerk/clerk-expo` (or the Expo-supported Clerk package for SDK 57)
 * - Provide sign-in / sign-up / session restoration here
 * - Call `setApiTokenGetter` from `../api/client` with Clerk `getToken`
 * - Enforce protected routes in Expo Router layouts — never trust client roles
 */

export type AuthSession = {
  userId: string;
  isSignedIn: boolean;
};

/**
 * Placeholder until Clerk is integrated. Callers must not treat this as a
 * real session.
 */
export function getAuthStatus(): AuthSession {
  return {
    userId: "",
    isSignedIn: false,
  };
}

export async function signOut(): Promise<void> {
  // Intentionally empty until Clerk is wired.
}