"use client"

import { BulkConfirmDialog } from "@/components/admin/bulk-confirm-dialog"
import { EmptyState } from "@/components/shared/page-elements"
import { ReassignDraftsDialog } from "@/components/surveys/reassign-drafts-dialog"
import {
  buildRegistryScopeLines,
  emptyScope,
  SurveyRegistryHeader,
  type RegistryScopeState,
} from "@/components/surveys/survey-registry-header"
import { SurveyRegistryTable, type SurveyRegistrySearchField } from "@/components/surveys/survey-registry-table"
import { SurveyRegistryToolbar } from "@/components/surveys/survey-registry-toolbar"
import {
  useDistricts,
  useRegistryData,
  useRegistryImportMutation,
  useStates,
  useSurveyMutations,
  useUlbs,
  useWards,
} from "@/hooks/use-api"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHydrateGeoScopeFromSearchParams } from "@/hooks/use-hydrate-geo-scope"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SurveyRegistryCounts, SurveyRegistryRecord, SurveyRegistryTab } from "@/lib/api/types"
import { exportRegistryToExcel, parseRegistryExcelFile } from "@/lib/survey-registry-xlsx"
import { useAuthStore } from "@/stores/app-store"
import type { RowSelectionState } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

function SurveysPageInner() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")
  const canImport = hasPermission("survey:create")
  const canReassign = hasPermission("survey:assign")
  const canExport = hasPermission("report:export") || hasPermission("survey:view")
  const canSubmit = hasPermission("survey:submit")
  const canDelete = hasPermission("survey:delete")

  const [scope, setScope] = useState<RegistryScopeState>(emptyScope)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState("")
  const [searchField, setSearchField] = useState<SurveyRegistrySearchField>("all")
  const [tab, setTab] = useState<SurveyRegistryTab>("all")
  const [lastCounts, setLastCounts] = useState<SurveyRegistryCounts | undefined>()
  const [reassignOpen, setReassignOpen] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 300)

  const surveyMutations = useSurveyMutations()
  const scopeReady = Boolean(scope.districtId && scope.ulbId && scope.wardId)

  const clearSelection = useCallback(() => setRowSelection({}), [])

  useHydrateGeoScopeFromSearchParams(
    useCallback((hydrated) => {
      setScope((prev) => ({
        stateId: hydrated.stateId ?? prev.stateId,
        districtId: hydrated.districtId ?? prev.districtId,
        ulbId: hydrated.ulbId ?? prev.ulbId,
        wardId: hydrated.wardId ?? prev.wardId,
      }))
      setPage(1)
      setRowSelection({})
    }, [])
  )

  const onScopeChange = useCallback((next: RegistryScopeState) => {
    setScope(next)
    setPage(1)
    setRowSelection({})
    setLastCounts(undefined)
  }, [])

  const filters = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch || undefined,
      searchField,
      tab,
      districtId: scope.districtId || undefined,
      ulbId: scope.ulbId || undefined,
      wardId: scope.wardId || undefined,
      sortBy: "parcelNumber",
      sortOrder: "asc" as const,
    }),
    [page, limit, debouncedSearch, searchField, tab, scope.districtId, scope.ulbId, scope.wardId]
  )

  const registryQuery = useRegistryData(filters, Boolean(canView) && scopeReady)
  const importMutation = useRegistryImportMutation()

  useEffect(() => {
    if (registryQuery.data?.counts) {
      setLastCounts(registryQuery.data.counts)
    }
  }, [registryQuery.data?.counts])

  useEffect(() => {
    clearSelection()
  }, [page, limit, debouncedSearch, searchField, tab, scope.districtId, scope.ulbId, scope.wardId, clearSelection])

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(scope.stateId || undefined)
  const { data: ulbs } = useUlbs(scope.districtId || undefined)
  const { data: wards } = useWards(scope.ulbId || undefined)

  const scopeLines = useMemo(() => {
    const stateName = states?.items?.find((s) => s.id === scope.stateId)?.name
    const districtName =
      districts?.items?.find((d) => d.id === scope.districtId)?.name ??
      registryQuery.data?.scope?.districtName ??
      undefined
    const ulbName =
      ulbs?.items?.find((u) => u.id === scope.ulbId)?.name ?? registryQuery.data?.scope?.ulbName ?? undefined
    const ward = wards?.items?.find((w) => w.id === scope.wardId) ?? null
    return buildRegistryScopeLines({
      stateName: stateName ?? undefined,
      districtName: districtName ?? undefined,
      ulbName: ulbName ?? undefined,
      ward,
    })
  }, [states?.items, districts?.items, ulbs?.items, wards?.items, scope, registryQuery.data?.scope])

  const rows = registryQuery.data?.items ?? []

  const selectedRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]))
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => byId.get(key))
      .filter(Boolean) as SurveyRegistryRecord[]
  }, [rows, rowSelection])

  const selectedIds = useMemo(() => selectedRows.map((row) => row.id), [selectedRows])
  const selectedCount = selectedIds.length

  if (!canView) {
    return (
      <EmptyState
        title="Survey Registry unavailable"
        description="You do not have permission to view field survey records."
      />
    )
  }

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

  const summarizeBulk = (
    result: { succeeded: string[]; failed: Array<{ id: string; reason: string }> },
    verb: string
  ) => {
    if (result.succeeded.length && !result.failed.length) {
      toast.success(`${verb} ${result.succeeded.length} survey${result.succeeded.length === 1 ? "" : "s"}`)
      return
    }
    if (result.succeeded.length && result.failed.length) {
      toast.warning(
        `${verb} ${result.succeeded.length}; ${result.failed.length} failed. ${result.failed[0]?.reason ?? ""}`.trim()
      )
      return
    }
    toast.error(result.failed[0]?.reason ?? `Unable to ${verb.toLowerCase()} selected surveys`)
  }

  const onConfirmDelete = async () => {
    try {
      const result = await surveyMutations.bulkDelete.mutateAsync(selectedIds)
      summarizeBulk(result, "Deleted")
      clearSelection()
      setDeleteOpen(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const onConfirmSubmit = async () => {
    try {
      const result = await surveyMutations.bulkSubmit.mutateAsync(selectedIds)
      summarizeBulk(result, "Sent to QC")
      clearSelection()
      setSubmitOpen(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const selectionToolbar =
    selectedCount > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{selectedCount} selected</span>
        {canSubmit ? (
          <Button type="button" size="sm" className="h-8 cursor-pointer" onClick={() => setSubmitOpen(true)}>
            Send to QC
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 cursor-pointer"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>
    ) : null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <SurveyRegistryHeader scopeLines={scopeLines} scope={scope} onScopeChange={onScopeChange} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SurveyRegistryToolbar
          onExport={onExport}
          onImportFile={(file) => void onImportFile(file)}
          onReassign={() => setReassignOpen(true)}
          exportDisabled={!canExport || !scopeReady || registryQuery.isLoading || !rows.length}
          importPending={importMutation.isPending}
          canImport={canImport}
          canReassign={canReassign}
        />
      </div>

      {registryQuery.isLoading && !registryQuery.data && scopeReady ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <SurveyRegistryTable
          data={scopeReady ? rows : []}
          isLoading={scopeReady && registryQuery.isFetching}
          isError={scopeReady && registryQuery.isError}
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
          counts={scopeReady ? (registryQuery.data?.counts ?? lastCounts) : undefined}
          page={page}
          limit={limit}
          totalPages={scopeReady ? (registryQuery.data?.meta.totalPages ?? 1) : 1}
          total={scopeReady ? (registryQuery.data?.meta.total ?? 0) : 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size)
            setPage(1)
          }}
          toolbar={selectionToolbar}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          scopeReady={scopeReady}
        />
      )}

      <ReassignDraftsDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        districtId={scope.districtId || undefined}
        ulbId={scope.ulbId || undefined}
        wardId={scope.wardId || undefined}
      />

      <BulkConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selectedCount} selected survey${selectedCount === 1 ? "" : "s"}?`}
        description="This soft-deletes draft surveys. Submitted and approved surveys cannot be deleted here. This action cannot be undone from the registry."
        confirmWord="DELETE"
        confirmLabel="Delete"
        pending={surveyMutations.bulkDelete.isPending}
        onConfirm={onConfirmDelete}
      />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Send {selectedCount} selected survey{selectedCount === 1 ? "" : "s"} to QC?
            </DialogTitle>
            <DialogDescription>
              Eligible draft surveys will be submitted for QC review. Incomplete or ineligible records will be skipped
              with an error reason.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={surveyMutations.bulkSubmit.isPending}
              onClick={() => void onConfirmSubmit()}
            >
              {surveyMutations.bulkSubmit.isPending ? "Sending…" : "Send to QC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
