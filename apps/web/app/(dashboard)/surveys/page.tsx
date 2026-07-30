"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ReassignDraftsDialog } from "@/components/surveys/reassign-drafts-dialog"
import { emptyScope, SurveyRegistryHeader, type RegistryScopeState } from "@/components/surveys/survey-registry-header"
import { SurveyRegistryTable } from "@/components/surveys/survey-registry-table"
import { SurveyRegistryToolbar } from "@/components/surveys/survey-registry-toolbar"
import { useDistricts, useRegistryData, useRegistryImportMutation, useUlbs, useWards } from "@/hooks/use-api"
import { useHydrateGeoScopeFromSearchParams } from "@/hooks/use-hydrate-geo-scope"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SurveyRegistryTab } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { exportRegistryToExcel, parseRegistryExcelFile } from "@/lib/survey-registry-xlsx"
import { useAuthStore } from "@/stores/app-store"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Suspense, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

function SurveysPageInner() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")
  const canImport = hasPermission("survey:create")
  const canReassign = hasPermission("survey:assign")
  const canExport = hasPermission("report:export") || hasPermission("survey:view")

  const [scope, setScope] = useState<RegistryScopeState>(emptyScope)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<SurveyRegistryTab>("all")
  const [reassignOpen, setReassignOpen] = useState(false)

  useHydrateGeoScopeFromSearchParams(
    useCallback((hydrated) => {
      setScope((prev) => ({
        stateId: hydrated.stateId ?? prev.stateId,
        districtId: hydrated.districtId ?? prev.districtId,
        ulbId: hydrated.ulbId ?? prev.ulbId,
        wardId: hydrated.wardId ?? prev.wardId,
      }))
      setPage(1)
    }, [])
  )

  const onScopeChange = useCallback((next: RegistryScopeState) => {
    setScope(next)
    setPage(1)
  }, [])

  const filters = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      tab,
      districtId: scope.districtId || undefined,
      ulbId: scope.ulbId || undefined,
      wardId: scope.wardId || undefined,
      sortBy: "createdAt",
      sortOrder: "desc" as const,
    }),
    [page, limit, search, tab, scope.districtId, scope.ulbId, scope.wardId]
  )

  const registryQuery = useRegistryData(filters, Boolean(canView))
  const importMutation = useRegistryImportMutation()

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

  if (!canView) {
    return (
      <EmptyState
        title="Survey Registry unavailable"
        description="You do not have permission to view field survey records."
      />
    )
  }

  const rows = registryQuery.data?.items ?? []

  const onExport = () => {
    if (!rows.length) {
      toast.error("No rows available to export")
      return
    }
    exportRegistryToExcel(rows)
    toast.success(`Exported ${rows.length} registry rows`)
  }

  const onImportFile = async (file: File) => {
    try {
      const parsed = await parseRegistryExcelFile(file)
      const result = await importMutation.mutateAsync(file)
      toast.success(result.message ?? `Import queued${parsed.length ? ` (${parsed.length} rows detected)` : ""}`)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <SurveyRegistryHeader scopeLabel={scopeLabel} scope={scope} onScopeChange={onScopeChange} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SurveyRegistryToolbar
          onExport={onExport}
          onImportFile={(file) => void onImportFile(file)}
          onReassign={() => setReassignOpen(true)}
          exportDisabled={!canExport || registryQuery.isLoading || !rows.length}
          importPending={importMutation.isPending}
          canImport={canImport}
          canReassign={canReassign}
        />
      </div>

      {registryQuery.isLoading && !registryQuery.data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <SurveyRegistryTable
          data={rows}
          isLoading={registryQuery.isFetching}
          isError={registryQuery.isError}
          search={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          tab={tab}
          onTabChange={(next) => {
            setTab(next)
            setPage(1)
          }}
          counts={registryQuery.data?.counts}
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

      <ReassignDraftsDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        districtId={scope.districtId || undefined}
        ulbId={scope.ulbId || undefined}
        wardId={scope.wardId || undefined}
      />
    </div>
  )
}

export default function SurveysPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      }
    >
      <SurveysPageInner />
    </Suspense>
  )
}
