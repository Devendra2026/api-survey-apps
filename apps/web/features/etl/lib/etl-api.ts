import type {
  EtlJobsListResponse,
  EtlReportResponse,
  EtlStartResult,
  EtlStatusResponse,
} from "@/features/etl/lib/types"
import { apiGet, apiPost } from "@/lib/api/client"

export function getEtlStatus() {
  return apiGet<EtlStatusResponse>("/etl/status")
}

export function listEtlJobs(limit = 20) {
  return apiGet<EtlJobsListResponse>(`/etl/jobs?limit=${limit}`)
}

export function getEtlReport(jobId: string) {
  return apiGet<EtlReportResponse>(`/etl/report?jobId=${encodeURIComponent(jobId)}`)
}

export function startEtlIncremental(batchSize?: number) {
  return apiPost<EtlStartResult>("/etl/incremental-sync", batchSize ? { batchSize } : {})
}

export function startEtlFull(opts?: { batchSize?: number; force?: boolean }) {
  return apiPost<EtlStartResult>("/etl/full-migration", {
    batchSize: opts?.batchSize,
    force: opts?.force,
  })
}

export function retryEtlFailed(maxRetries?: number) {
  return apiPost<EtlStartResult>("/etl/retry-failed", maxRetries ? { maxRetries } : {})
}

export function startEtlValidate() {
  return apiPost<EtlStartResult>("/etl/validate", {})
}
