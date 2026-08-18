"use client"

import { QcFilterPanel } from "@/components/qc/qc-filter-panel"
import { QcMetricSummary } from "@/components/qc/qc-metric-summary"
import { QcWardGrid } from "@/components/qc/qc-ward-grid"
import { EmptyState } from "@/components/shared/page-elements"
import { useQcMetrics, useQcWards } from "@/hooks/use-api"
import type { QcCommandCenterFilters } from "@/lib/api/types"
import { allotmentScopeFromProfile } from "@/lib/qc/allotment-scope"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { ClipboardCheck } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

export default function QcCommandCenterPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const profile = useAuthStore((s) => s.profile)
  const canApprove = hasPermission("survey:approve")

  const allotmentDefaults = useMemo(() => allotmentScopeFromProfile(profile?.tenantRoles), [profile?.tenantRoles])

  const [stateId, setStateId] = useState(allotmentDefaults?.stateId ?? "")
  const [filters, setFilters] = useState<QcCommandCenterFilters>(() => ({
    districtId: allotmentDefaults?.districtId || undefined,
    ulbId: allotmentDefaults?.ulbId || undefined,
    wardId: allotmentDefaults?.wardId || undefined,
  }))

  const onChange = useCallback((next: QcCommandCenterFilters) => setFilters(next), [])
  const onStateChange = useCallback((next: string) => {
    setStateId(next)
    setFilters((prev) => ({
      ...prev,
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
    }))
  }, [])

  const metricsQuery = useQcMetrics(filters, Boolean(canApprove))
  const wardsQuery = useQcWards(filters, Boolean(canApprove) && Boolean(filters.ulbId))

  if (!canApprove) {
    return (
      <EmptyState
        title="QC Command Center unavailable"
        description="You need survey approval permission to view QC ward operations."
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase dark:text-teal-400">
            Quality Control
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">QC Command Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitor ward-wise QC pending queues and jump into review, registry, reports, or demand notices.
          </p>
        </div>
        <Button variant="outline" className="cursor-pointer" asChild>
          <Link href="/qc/registry">
            <ClipboardCheck className="size-4" />
            Open QC Review
          </Link>
        </Button>
      </header>

      <QcFilterPanel
        filters={filters}
        onChange={onChange}
        stateId={stateId}
        onStateChange={onStateChange}
        allotmentDefaults={allotmentDefaults}
      />

      <QcMetricSummary metrics={metricsQuery.data} isLoading={metricsQuery.isLoading} />

      <QcWardGrid
        wards={wardsQuery.data ?? []}
        isLoading={Boolean(filters.ulbId) && wardsQuery.isLoading}
        hasUlbSelected={Boolean(filters.ulbId)}
        ulbId={filters.ulbId}
      />
    </div>
  )
}
