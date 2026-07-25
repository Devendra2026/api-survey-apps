export type RetryKind = "transient" | "permanent"

const TRANSIENT_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /socket hang up/i,
  /network/i,
  /timeout/i,
  /503/,
  /502/,
  /429/,
  /SlowDown/i,
  /RequestTimeout/i,
  /TemporaryFailure/i,
  /ServiceUnavailable/i,
]

const PERMANENT_PATTERNS = [
  /MIME type not allowed/i,
  /Empty image buffer/i,
  /Unable to detect image MIME/i,
  /exceeds max size/i,
  /Geo catalog not found/i,
  /Missing required field/i,
  /Invalid coordinates/i,
  /duplicate/i,
  /checksum/i,
]

export function classifyError(error: unknown): RetryKind {
  const message = error instanceof Error ? error.message : String(error)
  if (PERMANENT_PATTERNS.some((re) => re.test(message))) return "permanent"
  if (TRANSIENT_PATTERNS.some((re) => re.test(message))) return "transient"
  // Default transient for unknown network-ish failures so BullMQ can retry
  return "transient"
}

export function computeBackoffMs(attempt: number, baseMs = 1_000, maxMs = 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * 250)
  return exp + jitter
}
