"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { CommandCenterFiltersPanel } from "@/components/surveys/command-center-filters"
import { CommandCenterKpiRow } from "@/components/surveys/command-center-kpis"
import { CommandCenterWardGrid } from "@/components/surveys/command-center-ward-grid"
import { useCommandCenterKPIs, useWardWiseData } from "@/hooks/use-api"
import type { CommandCenterFilters } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useCallback, useState } from "react"

export default function CommandCenterPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")
  const canCreate = hasPermission("survey:create")

  const [stateId, setStateId] = useState("")
  const [filters, setFilters] = useState<CommandCenterFilters>({
    surveyStatus: "any",
  })

  const onChange = useCallback((next: CommandCenterFilters) => setFilters(next), [])
  const onStateChange = useCallback((next: string) => {
    setStateId(next)
    setFilters((prev) => ({
      ...prev,
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
    }))
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-rose-700 uppercase dark:text-rose-400">
            Field Surveys
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Survey Command Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Filter by district, ULB, and ward to monitor ward-wise field progress and surveyor activity in real time.
          </p>
        </div>
        {canCreate ? (
          <Button
            className="cursor-pointer bg-linear-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
            asChild
          >
            <Link href="/surveys/new">
              <Plus className="size-4" />
              New Survey
            </Link>
          </Button>
        ) : null}
      </header>

      <CommandCenterFiltersPanel
        filters={filters}
        onChange={onChange}
        stateId={stateId}
        onStateChange={onStateChange}
      />

      <CommandCenterKpiRow kpis={kpisQuery.data} isLoading={kpisQuery.isLoading} />

      <CommandCenterWardGrid
        wards={wardsQuery.data ?? []}
        isLoading={Boolean(filters.ulbId) && wardsQuery.isLoading}
        hasUlbSelected={Boolean(filters.ulbId)}
        ulbId={filters.ulbId}
      />
    </div>
  )
}
