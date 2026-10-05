/** Client warning only. Submit still requires latitude and longitude. */
export const GPS_FRESHNESS_MS = 24 * 60 * 60 * 1000

export function gpsFreshnessWarning(capturedAt: string | null, now = Date.now()): string | null {
  if (!capturedAt) return null
  const captured = Date.parse(capturedAt)
  if (Number.isNaN(captured)) return null
  if (now - captured > GPS_FRESHNESS_MS) {
    return "This location is more than 24 hours old. Capture it again before you submit."
  }
  return null
}
