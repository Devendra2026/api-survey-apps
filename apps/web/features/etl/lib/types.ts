/** Nest `/etl/*` response shapes used by the admin UI. */

export type EtlJobType = "FULL" | "INCREMENTAL" | "RETRY_FAILED" | "VALIDATE"

export type EtlJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | string

export type EtlMigrationJob = {
  id: string
  type: EtlJobType
  status: EtlJobStatus
  batchSize: number
  cursor: string | null
  startedAt: string | null
  finishedAt: string | null
  statsJson: unknown
  createdById: string | null
  correlationId: string
  createdAt: string
  updatedAt: string
}

export type EtlStartResult = {
  jobId: string
  correlationId: string
}

export type EtlStatusResponse = {
  etlEnabled: boolean
  activeJob: EtlMigrationJob | null
  migrationState: {
    completed: number
    failed: number
    pending: number
  }
}

export type EtlReportResponse = {
  jobId: string
  type: EtlJobType
  status: EtlJobStatus
  startedAt: string | null
  finishedAt: string | null
  cursor: string | null
  stats: unknown
  correlationId: string
}

export type EtlJobsListResponse = {
  items: EtlMigrationJob[]
}

export function isEtlJobActive(status: EtlJobStatus | undefined | null): boolean {
  return status === "QUEUED" || status === "RUNNING"
}
