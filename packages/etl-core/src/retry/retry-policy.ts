import { ConvexEtlHttpError } from "../extract/convex-etl-error.js"

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
  // A typed HTTP status beats message pattern matching: a 401 must never be
  // retried, and the TRANSIENT_PATTERNS below would otherwise match on digits.
  if (error instanceof ConvexEtlHttpError) {
    return error.isRetryable ? "transient" : "permanent"
  }
  const message = error instanceof Error ? error.message : String(error)
  if (PERMANENT_PATTERNS.some((re) => re.test(message))) return "permanent"
  if (TRANSIENT_PATTERNS.some((re) => re.test(message))) return "transient"
  // Default transient for unknown network-ish failures so BullMQ can retry
  return "transient"
}

/** True when retrying cannot succeed, so the queue should stop and the job row must close now. */
export function isPermanentFailure(error: unknown): boolean {
  return classifyError(error) === "permanent"
}

/** Operator-facing next step when a failure is known to be permanent. */
export function remediationFor(error: unknown): string | undefined {
  return error instanceof ConvexEtlHttpError ? error.remediation : undefined
}

export function computeBackoffMs(attempt: number, baseMs = 1_000, maxMs = 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * 250)
  return exp + jitter
}

export interface AttemptBudget {
  /** BullMQ `job.attemptsMade`: attempts already failed, so the first run sees 0. */
  attemptsMade: number
  /** BullMQ `job.opts.attempts`; absent means the job runs once. */
  maxAttempts?: number
}

/**
 * True when the queue will not retry again, so the owning MigrationJob row
 * must be closed out instead of being left in RUNNING forever.
 */
export function isFinalAttempt({ attemptsMade, maxAttempts }: AttemptBudget): boolean {
  const budget = Math.max(1, maxAttempts ?? 1)
  return attemptsMade + 1 >= budget
}
