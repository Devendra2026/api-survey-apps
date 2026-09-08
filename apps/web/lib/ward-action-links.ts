import type { QcRegistryTab } from "@/lib/api/types"

export type WardAction = "startQc" | "registry" | "demand" | "report"

export type WardActionIds = {
  wardId: string
  ulbId: string
}

export type ScopeFromSearchParams = {
  wardId?: string
  ulbId?: string
  status?: string
}

/** Build `ulbId`/`wardId` search params for Survey Registry scope persistence. */
export function buildRegistryScopeSearchParams(ids: Partial<WardActionIds>): URLSearchParams {
  const params = new URLSearchParams()
  const ulbId = ids.ulbId?.trim()
  const wardId = ids.wardId?.trim()
  if (ulbId) params.set("ulbId", ulbId)
  if (wardId) params.set("wardId", wardId)
  return params
}

/** Survey Registry list URL with optional geographic scope query. */
export function buildSurveyRegistryHref(ids?: Partial<WardActionIds>): string {
  const params = buildRegistryScopeSearchParams(ids ?? {})
  const qs = params.toString()
  return qs ? `/surveys?${qs}` : "/surveys"
}

/** Survey View URL preserving Registry scope for Back navigation. */
export function buildSurveyViewHref(surveyId: string, ids?: Partial<WardActionIds>): string {
  const params = buildRegistryScopeSearchParams(ids ?? {})
  const qs = params.toString()
  return qs ? `/surveys/${surveyId}?${qs}` : `/surveys/${surveyId}`
}

/** QC Review Registry list URL with optional geographic scope (+ status) query. */
export function buildQcRegistryHref(ids?: Partial<WardActionIds>, status?: string): string {
  const params = buildRegistryScopeSearchParams(ids ?? {})
  const statusValue = status?.trim()
  if (statusValue) params.set("status", statusValue)
  const qs = params.toString()
  return qs ? `/qc/registry?${qs}` : "/qc/registry"
}

/** QC Review URL preserving Registry scope for Back navigation. */
export function buildQcReviewHref(surveyId: string, ids?: Partial<WardActionIds>): string {
  const params = buildRegistryScopeSearchParams(ids ?? {})
  const qs = params.toString()
  return qs ? `/qc/review/${surveyId}?${qs}` : `/qc/review/${surveyId}`
}

/**
 * Queue endpoints authorize All Wards (ULB) scope via `ulbId`.
 * Omit the param when the caller has no known ULB — do not invent one.
 */
export function buildQcQueueSearchParams(args: {
  wardId: string
  ulbId?: string | null
  surveyId?: string
  parcelNumber?: string
}): string {
  const params = new URLSearchParams()
  params.set("wardId", args.wardId)
  const ulbId = args.ulbId?.trim()
  if (ulbId) params.set("ulbId", ulbId)
  const surveyId = args.surveyId?.trim()
  if (surveyId) params.set("surveyId", surveyId)
  const parcelNumber = args.parcelNumber?.trim()
  if (parcelNumber) params.set("parcelNumber", parcelNumber)
  return params.toString()
}

/** Build deep-link hrefs for ward card actions (IDs only). */
export function buildWardActionHref(action: WardAction, ids: WardActionIds): string {
  const params = buildRegistryScopeSearchParams(ids)

  switch (action) {
    case "startQc":
      return `/qc/queue/start?${params.toString()}`
    case "registry":
      return buildSurveyRegistryHref(ids)
    case "demand":
      return `/reports/demand-notices?${params.toString()}`
    case "report":
      return `/reports?${params.toString()}`
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

export function readScopeFromSearchParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): ScopeFromSearchParams {
  const wardId = searchParams.get("wardId")?.trim() || undefined
  const ulbId = searchParams.get("ulbId")?.trim() || undefined
  const status = searchParams.get("status")?.trim() || undefined
  return { wardId, ulbId, status }
}

export function isQcRegistryTab(value: string | undefined): value is QcRegistryTab {
  return (
    value === "pendingApproved" ||
    value === "pendingQc" ||
    value === "approved" ||
    value === "returned" ||
    value === "parcelShared" ||
    value === "all"
  )
}
