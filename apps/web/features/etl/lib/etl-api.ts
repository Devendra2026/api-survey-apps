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

export function startEtlRefreshPending(opts: { districtId: string; apply: boolean; batchSize?: number }) {
  return apiPost<{
    mode: "dry-run" | "apply"
    districtId: string
    districtName: string
    wouldUpdate: number
    wouldSkipTerminal: number
    jobId: string | null
    correlationId?: string
  }>("/etl/refresh-pending", opts)
}

export type ReconcileResult = {
  districtId: string
  districtName: string
  totals: {
    nestSurveys: number
    withLegacyId: number
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
    onlyConvexSampled: number
  }
  byUlb: Array<{
    ulbCode: string
    ulbName: string
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
  }>
  samples: {
    statusMismatch: Array<{
      legacySurveyId: string
      nestStatus: string
      convexStatus: string
      wardNo: string
    }>
    wardMismatch: Array<{
      legacySurveyId: string
      nestWard: string
      convexWard: string
    }>
    onlyNest: Array<{ surveyId: string; legacySurveyId: string | null }>
    onlyConvex: Array<{ legacySurveyId: string; municipalityCode: string; wardNo: string; status: string }>
  }
}

export function reconcileWithConvex(districtId: string) {
  return apiPost<ReconcileResult>("/etl/reconcile-with-convex", { districtId })
}

export type WardDedupeResult = {
  mode: "dry-run" | "apply"
  ulbs: number
  duplicateGroups: number
  surveysRemapped: number
  wardsSoftDeleted: number
  samples: Array<{
    ulb: string
    norm: string
    primary: { id: string; wardNumber: string; surveys: number }
    dupes: Array<{ id: string; wardNumber: string; surveys: number }>
  }>
}

export type WardSyncResult = {
  mode: "dry-run" | "apply"
  catalogSize: number
  created: number
  updated: number
  merged: number
  skipped: number
  missingUlbs: string[]
  wardCountMismatches: Array<{ ulb: string; nest: number; convex: number }>
  conflicts: string[]
  preDedupe: {
    duplicateGroups: number
    wardsSoftDeleted: number
    surveysRemapped: number
  } | null
}

export type EmptyStateCleanupResult = {
  mode: "dry-run" | "apply"
  deleted: Array<{ id: string; code: string; name: string }>
  skipped: Array<{ id: string; code: string; name: string; reason: string }>
}

export function dedupeWards(apply: boolean, ulbCode?: string, districtId?: string) {
  return apiPost<WardDedupeResult>("/etl/dedupe-wards", {
    apply,
    ...(ulbCode ? { ulbCode } : {}),
    ...(districtId ? { districtId } : {}),
  })
}

export function syncWardsFromConvex(apply: boolean, districtId?: string) {
  return apiPost<WardSyncResult>("/etl/sync-wards-from-convex", { apply, ...(districtId ? { districtId } : {}) })
}

export function cleanupEmptyDuplicateStates(apply: boolean) {
  return apiPost<EmptyStateCleanupResult>("/etl/cleanup-empty-duplicate-states", { apply })
}

export type AlignWardsPipelineResult = {
  mode: "dry-run" | "apply"
  ok: boolean
  steps: {
    dedupe: {
      duplicateGroups: number
      wardsSoftDeleted: number
      surveysRemapped: number
      samples: WardDedupeResult["samples"]
    }
    sync: {
      catalogSize: number
      created: number
      updated: number
      merged: number
      skipped: number
      missingUlbs: string[]
      conflicts: string[]
    }
    cleanup: {
      deleted: EmptyStateCleanupResult["deleted"]
      skipped: EmptyStateCleanupResult["skipped"]
    }
    verify: {
      matchedUlbCount: number
      catalogSize: number
      mismatchedUlbs: Array<{ ulb: string; nest: number; convex: number }>
    }
  }
}

export function alignWardsWithConvex(apply: boolean, districtId: string) {
  return apiPost<AlignWardsPipelineResult>("/etl/align-wards-with-convex", { apply, districtId })
}
