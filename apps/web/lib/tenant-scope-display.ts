import type { TenantRole } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"

export type ScopeGeoDisplay = {
  stateName: string | null
  districtName: string | null
  ulbName: string | null
  wardLabel: string | null
  isAllWards: boolean
  isGlobal: boolean
}

export function resolveScopeGeoDisplay(role: TenantRole): ScopeGeoDisplay {
  const isGlobal = !role.stateId && !role.districtId && !role.ulbId && !role.wardId
  const wardLabel = role.ward ? formatWardOptionLabel(role.ward) : role.ulbId && !role.wardId ? "All Wards" : null

  return {
    stateName: role.state?.name ?? null,
    districtName: role.district?.name ?? null,
    ulbName: role.ulb?.name ?? null,
    wardLabel,
    isAllWards: Boolean(role.ulbId && !role.wardId),
    isGlobal,
  }
}

/** Compact header line — prioritizes ULB, then district. */
export function scopeHeaderLine(display: ScopeGeoDisplay): string {
  if (display.isGlobal) return "Full access"
  if (display.ulbName && display.districtName) {
    return `${display.districtName} · ${display.ulbName}`
  }
  return display.ulbName ?? display.districtName ?? display.stateName ?? "Assigned scope"
}

/** Secondary line for ward or all-wards hint. */
export function scopeHeaderSubline(display: ScopeGeoDisplay): string | null {
  if (display.isGlobal) return null
  return display.wardLabel
}

export function scopeBreadcrumb(display: ScopeGeoDisplay): string {
  if (display.isGlobal) return "Full access"
  return [display.districtName, display.ulbName, display.wardLabel].filter(Boolean).join(" → ")
}
