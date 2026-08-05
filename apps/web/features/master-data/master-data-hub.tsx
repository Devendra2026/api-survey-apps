"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { useGeographyTree, useReferenceCategories } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { computeGeoStats } from "@/features/master-data/lib/geo-stats"
import { MasterDataHero } from "@/features/master-data/master-data-hero"
import { MasterDataMetrics } from "@/features/master-data/master-data-metrics"
import { MasterDataRegistry, useMasterDataTabState } from "@/features/master-data/master-data-registry"
import { useStates } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Suspense, useMemo } from "react"

function MasterDataHubInner() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")

  const { activeTab, onTabChange, categoryFromUrl } = useMasterDataTabState()
  const { data: categories, isLoading: categoriesLoading } = useReferenceCategories()
  const { data: treeData, isLoading: treeLoading } = useGeographyTree()
  const { data: statesPage, isLoading: statesLoading } = useStates({ limit: 100 })

  const tree = useMemo((): GeographyTreeNode[] => {
    if (treeData && treeData.length > 0) return treeData
    const items = statesPage?.items ?? []
    if (items.length === 0) return treeData ?? []
    return items.map((s) => ({
      id: s.id,
      type: "state" as const,
      name: s.name,
      code: s.code,
      status: "ACTIVE" as const,
      counts: { districts: 0, surveys: 0 },
      children: [],
    }))
  }, [treeData, statesPage?.items])

  const geo = useMemo(() => computeGeoStats(tree), [tree])
  const metricsLoading = categoriesLoading || treeLoading || (statesLoading && !treeData?.length)

  if (!canView) {
    return <EmptyState title="Master Data unavailable" description="Requires settings:view." />
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <MasterDataHero />

      {metricsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <MasterDataMetrics
          activeTab={activeTab}
          categories={categories?.length ?? 0}
          districts={geo.districts}
          ulbs={geo.ulbs}
          wards={geo.wards}
        />
      )}

      <MasterDataRegistry
        activeTab={activeTab}
        onTabChange={onTabChange}
        districtCount={geo.districts}
        categoryFromUrl={categoryFromUrl}
      />
    </div>
  )
}

export function MasterDataHub() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-20 w-full max-w-xl rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <MasterDataHubInner />
    </Suspense>
  )
}
