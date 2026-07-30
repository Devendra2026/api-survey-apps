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

/** Build deep-link hrefs for ward card actions (IDs only). */
export function buildWardActionHref(action: WardAction, ids: WardActionIds): string {
  const params = new URLSearchParams()
  params.set("wardId", ids.wardId)
  params.set("ulbId", ids.ulbId)

  switch (action) {
    case "startQc":
      params.set("status", "pendingQc")
      return `/qc/registry?${params.toString()}`
    case "registry":
      return `/surveys?${params.toString()}`
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
