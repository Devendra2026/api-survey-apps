/**
 * Pure API URL resolution helpers (no Expo / React Native imports).
 * Used by `env.ts` at runtime and by Node unit tests.
 */

export type AppBuildEnv = "development" | "preview" | "production"

export class ApiUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiUrlConfigurationError"
  }
}

export function rewriteAndroidEmulatorLoopback(
  url: string,
  options: { platform: string; isDevice: boolean }
): string {
  if (options.platform !== "android" || options.isDevice) {
    return url
  }
  try {
    const parsed = new URL(url)
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = "10.0.2.2"
      return parsed.toString().replace(/\/$/, "")
    }
  } catch {
    return url
  }
  return url
}

function isLoopbackOrEmulatorHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "10.0.2.2" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1"
  )
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "")
}

function assertReleaseHttpsUrl(normalized: string, appEnv: "preview" | "production"): string {
  if (!normalized) {
    throw new ApiUrlConfigurationError(
      `EXPO_PUBLIC_API_URL is required for ${appEnv} builds and must be an HTTPS Nest API URL.`
    )
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new ApiUrlConfigurationError(
      `EXPO_PUBLIC_API_URL is not a valid URL for ${appEnv}: "${normalized}"`
    )
  }

  if (parsed.protocol !== "https:") {
    throw new ApiUrlConfigurationError(
      `${appEnv} builds reject non-HTTPS API URLs (got "${normalized}"). Set EXPO_PUBLIC_API_URL to https://…`
    )
  }

  if (isLoopbackOrEmulatorHost(parsed.hostname)) {
    throw new ApiUrlConfigurationError(
      `${appEnv} builds reject localhost / emulator API hosts (got "${normalized}").`
    )
  }

  return normalized
}

/**
 * Resolve the Nest API base URL for the current build environment.
 *
 * - development: EXPO_PUBLIC_API_URL or local emulator/simulator/LAN default; HTTP allowed
 * - preview: HTTPS required; never localhost/emulator; never silently falls back to production
 * - production: HTTPS required; never localhost/emulator/http
 *
 * Misconfiguration in preview/production throws {@link ApiUrlConfigurationError}
 * (never returns empty string, never invents a default).
 */
export function resolveApiBaseUrl(input: {
  appEnv: AppBuildEnv
  /** Alias used in tests / docs — same as fromEnv. */
  apiUrl?: string | undefined
  fromEnv?: string | undefined
  platform: string
  isDevice: boolean
  defaultUrl: string
}): string {
  const rawEnv = (input.apiUrl ?? input.fromEnv)?.trim()
  const fromEnv = rawEnv && rawEnv.length > 0 ? rawEnv : undefined

  if (input.appEnv === "preview" || input.appEnv === "production") {
    if (!fromEnv) {
      throw new ApiUrlConfigurationError(
        `EXPO_PUBLIC_API_URL is required for ${input.appEnv} builds and must be an HTTPS Nest API URL.`
      )
    }
    const normalized = normalizeBaseUrl(fromEnv)
    return assertReleaseHttpsUrl(normalized, input.appEnv)
  }

  // development
  if (fromEnv) {
    const normalized = normalizeBaseUrl(fromEnv)
    try {
      // Validate shape; development still allows http:// and LAN.
      new URL(normalized)
    } catch {
      throw new ApiUrlConfigurationError(
        `EXPO_PUBLIC_API_URL is not a valid URL: "${normalized}"`
      )
    }
    return rewriteAndroidEmulatorLoopback(normalized, {
      platform: input.platform,
      isDevice: input.isDevice,
    })
  }

  return input.defaultUrl
}
