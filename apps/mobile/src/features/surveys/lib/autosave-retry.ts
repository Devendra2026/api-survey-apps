export const AUTOSAVE_RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000] as const

/**
 * Delay before the next automatic autosave retry.
 * Returns null when the cap is reached so the loop stops and the user can retry.
 */
export function nextAutosaveRetryDelayMs(previousAutoRetries: number): number | null {
  if (previousAutoRetries < 0 || previousAutoRetries >= AUTOSAVE_RETRY_DELAYS_MS.length) {
    return null
  }
  return AUTOSAVE_RETRY_DELAYS_MS[previousAutoRetries] ?? null
}

/**
 * Autosave PATCH may be repeated after the network or a gateway failure.
 * 429, 413, and other 4xx responses wait for an explicit retry.
 */
export function isAutosaveAutoRetryable(error: { kind?: string; statusCode?: number } | null): boolean {
  if (!error) {
    return false
  }
  if (error.kind === "network" || error.kind === "timeout") {
    return true
  }
  const status = error.statusCode ?? 0
  return status === 502 || status === 503 || status === 504
}
