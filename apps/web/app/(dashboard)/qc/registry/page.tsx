"use client"

import { emptyQcScope, QcRegistryHeader, type QcRegistryScopeState } from "@/components/qc/qc-registry-header"
import { QcRegistryTable, type QcRegistrySearchField } from "@/components/qc/qc-registry-table"
import { EmptyState } from "@/components/shared/page-elements"
import { useDistricts, useQcRegistry, useUlbs, useWards } from "@/hooks/use-api"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHydrateGeoScopeFromSearchParams } from "@/hooks/use-hydrate-geo-scope"
import type { QcRegistryCounts, QcRegistryTab } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { isQcRegistryTab } from "@/lib/ward-action-links"
import { useAuthStore } from "@/stores/app-store"
import { useQcWorkingContext } from "@/stores/qc-working-context"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"

function QcReviewRegistryPageInner() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")
  const activeWardId = useQcWorkingContext((s) => s.activeWardId)
  const activeUlbId = useQcWorkingContext((s) => s.activeUlbId)
  const setActiveWard = useQcWorkingContext((s) => s.setActiveWard)

  const [scope, setScope] = useState<QcRegistryScopeState>(emptyQcScope)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState("")
  const [searchField, setSearchField] = useState<QcRegistrySearchField>("all")
  const [tab, setTab] = useState<QcRegistryTab>("pendingApproved")
  const [lastCounts, setLastCounts] = useState<QcRegistryCounts | undefined>()
  const debouncedSearch = useDebouncedValue(search, 300)

  useHydrateGeoScopeFromSearchParams(
    useCallback(
      (hydrated) => {
        setScope((prev) => ({
          stateId: hydrated.stateId ?? prev.stateId,
          districtId: hydrated.districtId ?? prev.districtId,
          ulbId: hydrated.ulbId ?? prev.ulbId,
          wardId: hydrated.wardId ?? prev.wardId,
        }))
        if (hydrated.status && isQcRegistryTab(hydrated.status)) {
          setTab(hydrated.status)
        }
        if (hydrated.wardId && hydrated.ulbId) {
          setActiveWard({ wardId: hydrated.wardId, ulbId: hydrated.ulbId })
        }
        setPage(1)
      },
      [setActiveWard]
    )
  )

  // Soft-default ward filter from QC working context (not a hard lock).
  useEffect(() => {
    if (!activeWardId || !activeUlbId) return
    setScope((prev) => {
      if (prev.wardId || prev.ulbId) return prev
      return { ...prev, ulbId: activeUlbId, wardId: activeWardId }
    })
  }, [activeWardId, activeUlbId])

  const onScopeChange = useCallback((next: QcRegistryScopeState) => {
    setScope(next)
    setPage(1)
  }, [])

  const filters = useMemo(() => {
    const wardScoped = Boolean(scope.wardId)
    return {
      page,
      limit,
      search: debouncedSearch || undefined,
      searchField,
      status: tab,
      districtId: scope.districtId || undefined,
      ulbId: scope.ulbId || undefined,
      wardId: scope.wardId || undefined,
      sortBy: wardScoped ? "parcelNumber" : "createdAt",
      sortOrder: (wardScoped ? "asc" : "desc") as "asc" | "desc",
    }
  }, [page, limit, debouncedSearch, searchField, tab, scope.districtId, scope.ulbId, scope.wardId])

  const registryQuery = useQcRegistry(filters, Boolean(canApprove))

  useEffect(() => {
    if (registryQuery.data?.counts) {
      setLastCounts(registryQuery.data.counts)
    }
  }, [registryQuery.data?.counts])

  const { data: districts } = useDistricts(scope.stateId || undefined)
  const { data: ulbs } = useUlbs(scope.districtId || undefined)
  const { data: wards } = useWards(scope.ulbId || undefined)

  const scopeLabel = useMemo(() => {
    if (registryQuery.data?.scope?.label) return registryQuery.data.scope.label
    const districtName = districts?.items?.find((d) => d.id === scope.districtId)?.name
    const ulbName = ulbs?.items?.find((u) => u.id === scope.ulbId)?.name
    const ward = wards?.items?.find((w) => w.id === scope.wardId)
    const wardName = ward ? formatWardOptionLabel(ward) : undefined
    return [districtName, ulbName, wardName].filter(Boolean).join(" - ")
  }, [registryQuery.data?.scope?.label, districts?.items, ulbs?.items, wards?.items, scope])

  if (!canApprove) {
    return (
      <EmptyState
        title="QC Review Registry unavailable"
        description="You need survey approval permission to review and approve submitted surveys."
      />
    )
  }

  const rows = registryQuery.data?.items ?? []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <QcRegistryHeader scopeLabel={scopeLabel} scope={scope} onScopeChange={onScopeChange} />

      {registryQuery.isLoading && !registryQuery.data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <QcRegistryTable
          data={rows}
          isLoading={registryQuery.isFetching}
          isError={registryQuery.isError}
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchField={searchField}
          onSearchFieldChange={(value) => {
            setSearchField(value)
            setPage(1)
          }}
          tab={tab}
          onTabChange={(next) => {
            setTab(next)
            setPage(1)
          }}
          counts={registryQuery.data?.counts ?? lastCounts}
          page={page}
          limit={limit}
          totalPages={registryQuery.data?.meta.totalPages ?? 1}
          total={registryQuery.data?.meta.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size)
            setPage(1)
          }}
        />
      )}
    </div>
  )
}

export default function QcReviewRegistryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      }
    >
      <QcReviewRegistryPageInner />
    </Suspense>
  )
}
