"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { CommandCenterFiltersPanel } from "@/components/surveys/command-center-filters"
import { CommandCenterKpiRow } from "@/components/surveys/command-center-kpis"
import { CommandCenterWardGrid } from "@/components/surveys/command-center-ward-grid"
import { useCommandCenterKPIs, useWardWiseData } from "@/hooks/use-api"
import type { CommandCenterFilters } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useCallback, useState } from "react"

export default function CommandCenterPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  const [stateId, setStateId] = useState("")
  const [filters, setFilters] = useState<CommandCenterFilters>({
    surveyStatus: "any",
  })

  const onChange = useCallback(
    (next: CommandCenterFilters | ((prev: CommandCenterFilters) => CommandCenterFilters)) => setFilters(next),
    []
  )
  const onStateChange = useCallback((next: string) => {
    setStateId(next)
    setFilters((prev) => ({
      ...prev,
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
    }))
  }, [])
  const onReset = useCallback(() => {
    setStateId("")
    setFilters({ surveyStatus: "any" })
  }, [])

  const kpisQuery = useCommandCenterKPIs(filters, Boolean(canView))
  const wardsQuery = useWardWiseData(filters, Boolean(canView) && Boolean(filters.ulbId))

  if (!canView) {
    return (
      <EmptyState
        title="Command Center unavailable"
        description="You do not have permission to view field survey operations."
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header>
        <span className="text-[10px] font-semibold tracking-[0.14em] text-rose-700 uppercase dark:text-rose-400">
          Field Surveys
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Survey Command Center</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Filter by district, ULB, and ward to monitor ward-wise field progress in real time.
        </p>
      </header>

      <CommandCenterFiltersPanel
        filters={filters}
        onChange={onChange}
        stateId={stateId}
        onStateChange={onStateChange}
        onReset={onReset}
      />

      <CommandCenterKpiRow kpis={kpisQuery.data} isLoading={kpisQuery.isLoading} />

      <CommandCenterWardGrid
        wards={wardsQuery.data ?? []}
        isLoading={Boolean(filters.ulbId) && wardsQuery.isLoading}
        hasUlbSelected={Boolean(filters.ulbId)}
        hasDistrictSelected={Boolean(filters.districtId)}
        ulbId={filters.ulbId}
      />
    </div>
  )
}
