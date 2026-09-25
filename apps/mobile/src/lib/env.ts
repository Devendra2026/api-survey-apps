import Constants from "expo-constants"
import * as Device from "expo-device"
import { Platform } from "react-native"

/**
 * Public client-safe config only. Never put secrets, Clerk secret keys,
 * database URLs, or AWS credentials here.
 *
 * Android emulator: host machine loopback is 10.0.2.2 (not localhost).
 * iOS simulator / Expo web: localhost reaches the host machine.
 * Physical device: prefer the Expo Metro host LAN IP on port 4000.
 */

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

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "")
  }
  return defaultApiUrl()
}

export function getClerkPublishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""
  if (!key) {
    return ""
  }
  // Fail closed: release binaries must not embed Clerk development keys.
  if (!__DEV__ && key.startsWith("pk_test_")) {
    return ""
  }
  return key
}

export function isLocalHttpApi(): boolean {
  return getApiBaseUrl().startsWith("http://")
}
