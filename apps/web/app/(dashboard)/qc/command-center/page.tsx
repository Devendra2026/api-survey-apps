"use client"

import { QcFilterPanel } from "@/components/qc/qc-filter-panel"
import { QcMetricSummary } from "@/components/qc/qc-metric-summary"
import { QcPipelineRow } from "@/components/qc/qc-pipeline-row"
import { QcWardGrid } from "@/components/qc/qc-ward-grid"
import { EmptyState } from "@/components/shared/page-elements"
import { useQcMetrics, useQcWards } from "@/hooks/use-api"
import type { QcCommandCenterFilters, QcPipelineStage } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { ShieldCheck } from "lucide-react"
import { useCallback, useState } from "react"

export default function QcCommandCenterPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  const [stateId, setStateId] = useState("")
  const [filters, setFilters] = useState<QcCommandCenterFilters>({})
  const [activeStage, setActiveStage] = useState<QcPipelineStage | null>(null)

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
        description="You need survey approval permission to use the QC Command Center."
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase dark:text-teal-400">
          <ShieldCheck className="size-3.5" />
          Quality Control
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">QC Command Center</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Set your district, ULB, and ward once in Smart Filters — then review surveys ward-by-ward until complete.
        </p>
      </header>

      <QcFilterPanel filters={filters} onChange={onChange} stateId={stateId} onStateChange={onStateChange} />

      <QcPipelineRow
        metrics={metricsQuery.data}
        isLoading={metricsQuery.isLoading || metricsQuery.isFetching}
        activeStage={activeStage}
        onStageChange={setActiveStage}
      />

      <QcMetricSummary metrics={metricsQuery.data} isLoading={metricsQuery.isLoading || metricsQuery.isFetching} />

      <QcWardGrid
        wards={wardsQuery.data ?? []}
        isLoading={Boolean(filters.ulbId) && (wardsQuery.isLoading || wardsQuery.isFetching)}
        hasUlbSelected={Boolean(filters.ulbId)}
        activeStage={activeStage}
      />
    </div>
  )
}
