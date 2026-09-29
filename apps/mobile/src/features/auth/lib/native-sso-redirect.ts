import Constants from "expo-constants"
import * as AuthSession from "expo-auth-session"
import { Platform } from "react-native"
import { getAppEnv } from "@/lib/env"
import {
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
 * Uses AuthSession so platform deep-link registration stays consistent with Expo.
 */
export function getNativeSsoRedirectUrl(): string {
  const scheme = resolveNativeSsoScheme(Constants.expoConfig?.scheme)
  const redirectUrl = AuthSession.makeRedirectUri({
    scheme,
    path: NATIVE_SSO_CALLBACK_PATH,
  })

  if (__DEV__) {
    console.log(
      `[AUTH] Clerk native redirect env=${getAppEnv()} platform=${Platform.OS} url=${redirectUrl}`
    )
  }

  return redirectUrl
}
