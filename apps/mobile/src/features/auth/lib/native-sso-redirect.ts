import { getAppEnv } from "@/lib/env"
import * as AuthSession from "expo-auth-session"
import Constants from "expo-constants"
import { Platform } from "react-native"
import {
  buildCanonicalNativeSsoRedirectUrl,
  NATIVE_SSO_CALLBACK_PATH,
  resolveNativeSsoScheme,
} from "./native-sso-redirect-core"

export {
  buildCanonicalNativeSsoRedirectUrl,
  NATIVE_SSO_CALLBACK_PATH,
  NATIVE_SSO_SCHEME_FALLBACK,
  resolveNativeSsoScheme,
} from "./native-sso-redirect-core"

/**
 * Single source of truth for Clerk Google SSO `redirectUrl`.
 *
 * Standalone / dev-client / Preview / Production builds must send the canonical
 * `{scheme}://sso-callback` that is allowlisted in Clerk Native applications.
 * AuthSession may return Expo Go `exp://` URLs — those are only used when the
 * session cannot use the app scheme (Expo Go).
 */
export function getNativeSsoRedirectUrl(): string {
  const scheme = resolveNativeSsoScheme(Constants.expoConfig?.scheme)
  const canonical = buildCanonicalNativeSsoRedirectUrl(scheme)
  const authSessionUrl = AuthSession.makeRedirectUri({
    scheme,
    path: NATIVE_SSO_CALLBACK_PATH,
  })

  // Prefer the allowlisted custom-scheme URI whenever AuthSession already resolved
  // to our app scheme (normalizes path / trailing-slash drift). Keep AuthSession's
  // URL only for Expo Go / proxy hosts that cannot deep-link via `mobile://`.
  const redirectUrl = authSessionUrl.startsWith(`${scheme}://`) ? canonical : authSessionUrl

  if (__DEV__) {
    console.log(
      `[AUTH] Clerk native redirect env=${getAppEnv()} platform=${Platform.OS} canonical=${canonical} authSession=${authSessionUrl} using=${redirectUrl}`
    )
  }

  return redirectUrl
}
