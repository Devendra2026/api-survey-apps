import type { MigrationStatus } from "../domain/types.js"

export interface MigrationStateRow {
  legacySurveyId: string
  status: MigrationStatus
  updatedAt: Date
}

/** Surveys already imported or intentionally skipped must not be reprocessed. */
export function shouldSkipSurvey(status: MigrationStatus | null | undefined): boolean {
  return status === "COMPLETED" || status === "SKIPPED"
}

/** Stuck IN_PROGRESS rows older than TTL should be recovered on resume. */
export function isStuckInProgress(
  row: MigrationStateRow,
  nowMs: number,
  ttlMs: number
): boolean {
  if (row.status !== "IN_PROGRESS") return false
  return nowMs - row.updatedAt.getTime() > ttlMs
}

export function nextRetryCount(current: number, maxRetries: number): {
  retryCount: number
  exhausted: boolean
} {
  const retryCount = current + 1
  return { retryCount, exhausted: retryCount > maxRetries }
}
