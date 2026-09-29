/** Matches `scheme` in apps/mobile/app.config.ts. */
export const NATIVE_SSO_SCHEME_FALLBACK = "mobile"

/** Matches Expo Router route `src/app/sso-callback.tsx`. */
export const NATIVE_SSO_CALLBACK_PATH = "sso-callback"

/**
 * Canonical Clerk Native SSO redirect (no trailing slash).
 * Must be allowlisted exactly under Clerk Dashboard → Native applications.
 */
export function buildCanonicalNativeSsoRedirectUrl(scheme: string = NATIVE_SSO_SCHEME_FALLBACK): string {
  const normalizedScheme = scheme.trim().replace(/:\/+$/, "") || NATIVE_SSO_SCHEME_FALLBACK
  return `${normalizedScheme}://${NATIVE_SSO_CALLBACK_PATH}`
}

/**
 * Prefer the Expo config scheme so the helper stays aligned with app.config.ts.
 * Falls back to `mobile` when config is unavailable (e.g. unit tests).
 */
export function resolveNativeSsoScheme(expoScheme: unknown): string {
  if (typeof expoScheme === "string" && expoScheme.trim().length > 0) {
    return expoScheme.trim()
  }
  if (Array.isArray(expoScheme)) {
    const first = expoScheme.find((entry) => typeof entry === "string" && entry.trim().length > 0)
    if (typeof first === "string") {
      return first.trim()
    }
  }
  return NATIVE_SSO_SCHEME_FALLBACK
}
