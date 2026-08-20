import type { MigrationStatus } from "../domain/types.js"

export interface MigrationStateRow {
  legacySurveyId: string
  status: MigrationStatus
  updatedAt: Date
}

/** Surveys already imported or intentionally skipped must not be reprocessed (default path). */
export function shouldSkipSurvey(status: MigrationStatus | null | undefined): boolean {
  return status === "COMPLETED" || status === "SKIPPED"
}

export interface ShouldSkipSurveyForImportInput {
  migrationStatus: MigrationStatus | null | undefined
  imagesImported?: number | null
  nestPhotoCount?: number | null
  nestQcStatus?: "PENDING" | "APPROVED" | "REJECTED" | null | undefined
  force?: boolean
}

/**
 * Default import skip: COMPLETED/SKIPPED rows are not reprocessed unless force is set
 * or a COMPLETED row still has zero Nest photos (photo backfill while QC is open).
 */
export function shouldSkipSurveyForImport(input: ShouldSkipSurveyForImportInput): boolean {
  if (input.force) return false
  if (!shouldSkipSurvey(input.migrationStatus)) return false
  if (input.migrationStatus === "SKIPPED") return true

  const needsPhotoBackfill = (input.nestPhotoCount ?? 0) === 0 || (input.imagesImported ?? 0) === 0
  const qcOpen = input.nestQcStatus !== "APPROVED" && input.nestQcStatus !== "REJECTED"
  if (needsPhotoBackfill && qcOpen) return false

  return true
}

/**
 * Refresh-pending mode: only skip when Nest QC is already terminal.
 * COMPLETED migration rows with PENDING Nest QC must be reprocessed.
 */
export function shouldSkipSurveyForRefresh(input: {
  migrationStatus: MigrationStatus | null | undefined
  nestQcStatus: "PENDING" | "APPROVED" | "REJECTED" | null | undefined
}): boolean {
  if (input.nestQcStatus === "APPROVED" || input.nestQcStatus === "REJECTED") {
    return true
  }
  if (input.migrationStatus === "SKIPPED") {
    return true
  }
  // PENDING Nest QC (or missing Nest row) → allow reprocess even if COMPLETED
  return false
}

/** Stuck IN_PROGRESS rows older than TTL should be recovered on resume. */
export function isStuckInProgress(row: MigrationStateRow, nowMs: number, ttlMs: number): boolean {
  if (row.status !== "IN_PROGRESS") return false
  return nowMs - row.updatedAt.getTime() > ttlMs
}

export function nextRetryCount(
  current: number,
  maxRetries: number
): {
  retryCount: number
  exhausted: boolean
} {
  const retryCount = current + 1
  return { retryCount, exhausted: retryCount > maxRetries }
}
