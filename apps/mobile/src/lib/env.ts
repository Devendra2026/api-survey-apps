import Constants from "expo-constants"
import * as Device from "expo-device"
import { Platform } from "react-native"
import {
  ApiUrlConfigurationError,
  resolveApiBaseUrl,
  rewriteAndroidEmulatorLoopback,
  type AppBuildEnv,
} from "./api-base-url"

/**
 * Public client-safe config only. Never put secrets, Clerk secret keys,
 * database URLs, or AWS credentials here.
 *
 * Android emulator: host machine loopback is 10.0.2.2 (not localhost).
 * iOS simulator / Expo web: localhost reaches the host machine.
 * Physical device: prefer the Expo Metro host LAN IP on port 4000.
 *
 * Preview / production binaries must set EXPO_PUBLIC_API_URL to HTTPS.
 * Localhost / emulator defaults are development-only.
 */

export {
  ApiUrlConfigurationError,
  resolveApiBaseUrl,
  rewriteAndroidEmulatorLoopback,
  type AppBuildEnv,
}

const API_PORT = 4000

function expoDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    (
      Constants as {
        manifest?: { debuggerHost?: string }
      }
    ).manifest?.debuggerHost

  if (!hostUri || typeof hostUri !== "string") {
    return null
  }

  const host = hostUri.split(":")[0]?.trim()
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return null
  }

  return host
}

function defaultApiUrl(): string {
  if (Device.isDevice) {
    const lanHost = expoDevHost()
    if (lanHost) {
      return `http://${lanHost}:${API_PORT}`
    }
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${API_PORT}`
  }

  return `http://localhost:${API_PORT}`
}

/** App env stamped by eas.json / app.config (`extra.appEnv`). Fail closed to production rules when unknown. */
export function getAppEnv(): AppBuildEnv {
  const fromExtra = Constants.expoConfig?.extra?.appEnv
  if (fromExtra === "development" || fromExtra === "preview" || fromExtra === "production") {
    return fromExtra
  }
  // Metro / unset → development. Release binary without stamp → production (strictest).
  return __DEV__ ? "development" : "production"
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl({
    appEnv: getAppEnv(),
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    platform: Platform.OS,
    isDevice: Device.isDevice,
    defaultUrl: defaultApiUrl(),
  })
}

export function getClerkPublishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""
  if (!key) {
    return ""
  }
  // Fail closed: production must never embed Clerk development keys.
  // Preview may use a staging Clerk instance (often pk_test_).
  if (getAppEnv() === "production" && key.startsWith("pk_test_")) {
    return ""
  }
  return key
}

/** Public Maps SDK key. Empty when unset — never invent or commit a key. */
export function getGoogleMapsApiKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ""
}

export function isLocalHttpApi(): boolean {
  try {
    const base = getApiBaseUrl()
    return base.length > 0 && base.startsWith("http://")
  } catch {
    return false
  }
}
