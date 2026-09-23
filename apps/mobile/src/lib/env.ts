import { Platform } from "react-native";

/**
 * Public client-safe config only. Never put secrets, Clerk secret keys,
 * database URLs, or AWS credentials here.
 *
 * Android emulator: host machine loopback is 10.0.2.2 (not localhost).
 * iOS simulator / Expo web: localhost reaches the host machine.
 */
function defaultApiUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }
  return "http://localhost:4000";
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return defaultApiUrl();
}