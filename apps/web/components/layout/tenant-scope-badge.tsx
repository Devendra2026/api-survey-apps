"use client"

import { useWards } from "@/hooks/use-api"
import { tenantRoleDisplayName, type TenantRole } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import {
  resolveScopeGeoDisplay,
  scopeBreadcrumb,
  scopeHeaderLine,
  scopeHeaderSubline,
  type ScopeGeoDisplay,
} from "@/lib/tenant-scope-display"
import { useAuthStore } from "@/stores/app-store"
import { useQcWorkingContext } from "@/stores/qc-working-context"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { Building2, ChevronDown, ClipboardCheck, LayoutGrid, MapPin } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

function ScopeDetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function ScopePopoverBody({
  role,
  display,
  roles,
  activeWardLabel,
  showQcLinks,
}: {
  role: TenantRole
  display: ScopeGeoDisplay
  roles: TenantRole[]
  activeWardLabel: string | null
  showQcLinks: boolean
}) {
  const roleLabel = tenantRoleDisplayName(role)

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase dark:text-teal-400">
            Tenant scope
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{scopeBreadcrumb(display)}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 rounded-md text-[10px] font-medium">
          {roleLabel}
        </Badge>
      </div>

      {!display.isGlobal ? (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <ScopeDetailRow label="State" value={display.stateName} />
          <ScopeDetailRow label="District" value={display.districtName} />
          <ScopeDetailRow label="ULB" value={display.ulbName} />
          <ScopeDetailRow label="Ward" value={display.wardLabel} />
        </div>
      ) : (
        <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/60">
          You have unrestricted access across all locations.
        </p>
      )}

      {activeWardLabel ? (
        <>
          <Separator />
          <div className="flex items-center gap-2 rounded-lg border border-teal-200/60 bg-teal-50/50 px-3 py-2 dark:border-teal-900/40 dark:bg-teal-950/30">
            <MapPin className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wide text-teal-700 uppercase dark:text-teal-400">
                Active QC ward
              </p>
              <p className="truncate text-sm font-medium text-foreground">{activeWardLabel}</p>
            </div>
          </div>
        </>
      ) : null}

      {roles.length > 1 ? (
        <p className="text-xs text-muted-foreground">+{roles.length - 1} additional active role assignment(s)</p>
      ) : null}

      {showQcLinks ? (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" asChild>
              <Link href="/qc/command-center">
                <LayoutGrid className="size-3.5" />
                Command Center
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/40"
              asChild
            >
              <Link href="/qc/registry">
                <ClipboardCheck className="size-3.5" />
                QC Registry
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function TenantScopeBadge() {
  const profile = useAuthStore((s) => s.profile)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const roles = profile?.tenantRoles?.filter((r) => r.isActive) ?? []
  const primary = roles[0]
  const activeWardId = useQcWorkingContext((s) => s.activeWardId)
  const activeUlbId = useQcWorkingContext((s) => s.activeUlbId)

  const display = useMemo(() => (primary ? resolveScopeGeoDisplay(primary) : null), [primary])
  const { data: activeWards } = useWards(activeWardId ? (activeUlbId ?? primary?.ulbId ?? undefined) : undefined)

  const activeWardLabel = useMemo(() => {
    if (!activeWardId) return null
    const ward = activeWards?.items?.find((w) => w.id === activeWardId)
    if (ward) return formatWardOptionLabel(ward)
    if (primary?.wardId === activeWardId && primary.ward) {
      return formatWardOptionLabel(primary.ward)
    }
    return "Selected ward"
  }, [activeWardId, activeWards?.items, primary?.ward, primary?.wardId])

  const showQcLinks = hasPermission("survey:approve")
  const headerLine = display ? scopeHeaderLine(display) : null
  const headerSubline = display ? scopeHeaderSubline(display) : null
  const showActiveWardInChip = Boolean(
    activeWardLabel && display && !display.isAllWards && primary?.wardId !== activeWardId
  )

  if (!roles.length || !primary || !display) {
    return (
      <div className="hidden items-center gap-2 rounded-xl border border-dashed border-slate-200 px-2.5 py-1.5 lg:flex dark:border-slate-700">
        <MapPin className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">No scope</span>
      </div>
    )
  }

  const roleLabel = tenantRoleDisplayName(primary)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "hidden max-w-[min(100vw-12rem,14rem)] cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 py-1 pr-2 pl-1.5 text-left transition-colors",
            "hover:border-teal-200 hover:bg-teal-50/40 focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:outline-none",
            "dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-teal-900/50 dark:hover:bg-teal-950/20",
            "lg:flex xl:max-w-xs"
          )}
          aria-label={`Tenant scope: ${scopeBreadcrumb(display)}`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 dark:bg-teal-500/15">
            {display.isGlobal ? (
              <Building2 className="size-3.5 text-teal-600 dark:text-teal-400" />
            ) : (
              <MapPin className="size-3.5 text-teal-600 dark:text-teal-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold tracking-wide text-teal-700 uppercase dark:text-teal-400">
              {roleLabel}
            </p>
            <p className="truncate text-xs leading-tight font-medium text-slate-900 dark:text-slate-50">{headerLine}</p>
            {(showActiveWardInChip ? activeWardLabel : headerSubline) ? (
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {showActiveWardInChip ? `Working: ${activeWardLabel}` : headerSubline}
              </p>
            ) : null}
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3" sideOffset={8}>
        <ScopePopoverBody
          role={primary}
          display={display}
          roles={roles}
          activeWardLabel={activeWardLabel}
          showQcLinks={showQcLinks}
        />
      </PopoverContent>
    </Popover>
  )
}
