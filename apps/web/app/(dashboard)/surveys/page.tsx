"use client"

import { DataTable, DataTableSelectColumn } from "@/components/data-table/data-table"
import { PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { SavedViewsMenu } from "@/components/surveys/saved-views-menu"
import {
  emptyRegistryFilters,
  SurveyRegistryFilters,
  type SurveyRegistryFiltersState,
} from "@/components/surveys/survey-registry-filters"
import { WardCommandCards } from "@/components/surveys/ward-command-cards"
import { useSurveyMutations, useSurveys, useWardCommandStats } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SavedView, SurveyListItem } from "@/lib/api/types"
import { useAuthStore, useUiStore } from "@/stores/app-store"
import type { ColumnDef, RowSelectionState, VisibilityState } from "@tanstack/react-table"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { CheckCircle2, Download, Plus, XCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

function asStringRecord(value: unknown): Partial<SurveyRegistryFiltersState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const keys: Array<keyof SurveyRegistryFiltersState> = [
    "surveyStatus",
    "qcStatus",
    "stateId",
    "districtId",
    "ulbId",
    "wardId",
    "surveyorId",
    "dateFrom",
    "dateTo",
    "mobile",
  ]
  const next: Partial<SurveyRegistryFiltersState> = {}
  for (const key of keys) {
    const raw = source[key]
    if (typeof raw === "string") next[key] = raw
  }
  return next
}

function asVisibility(value: unknown): VisibilityState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const next: VisibilityState = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "boolean") next[key] = raw
  }
  return next
}

function SurveysPageContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get("surveyStatus") ?? "all"
  const initialWardId = searchParams.get("wardId") ?? ""
  const globalSearch = useUiStore((s) => s.globalSearch)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<SurveyRegistryFiltersState>(() => ({
    ...emptyRegistryFilters(),
    surveyStatus: initialStatus,
    wardId: initialWardId,
  }))
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [rejectOpen, setRejectOpen] = useState(false)
  const [qcRemarks, setQcRemarks] = useState("")

  const query = useMemo(
    () => ({
      page,
      limit,
      search: search || globalSearch || undefined,
      surveyStatus: filters.surveyStatus === "all" ? undefined : filters.surveyStatus,
      qcStatus: filters.qcStatus === "all" ? undefined : filters.qcStatus,
      stateId: filters.stateId || undefined,
      districtId: filters.districtId || undefined,
      ulbId: filters.ulbId || undefined,
      wardId: filters.wardId || undefined,
      surveyorId: filters.surveyorId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      mobile: filters.mobile || undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    [page, limit, search, globalSearch, filters]
  )

  const { data, isLoading, isError } = useSurveys(query)
  const { data: wardStats = [], isLoading: wardsLoading } = useWardCommandStats({
    limit: 8,
    districtId: filters.districtId || undefined,
    ulbId: filters.ulbId || undefined,
  })
  const mutations = useSurveyMutations()

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [rowSelection]
  )

  const applyView = useCallback((view: SavedView) => {
    const nextFilters = { ...emptyRegistryFilters(), ...asStringRecord(view.filters) }
    setFilters(nextFilters)
    setColumnVisibility(asVisibility(view.columns))
    setPage(1)
    setRowSelection({})
  }, [])

  const columns = useMemo<ColumnDef<SurveyListItem>[]>(
    () => [
      DataTableSelectColumn<SurveyListItem>(),
      {
        accessorKey: "propertyId",
        header: "Property ID",
        cell: ({ row }) => (
          <Link href={`/surveys/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.propertyId}
          </Link>
        ),
      },
      {
        accessorKey: "respondentName",
        header: "Respondent",
        cell: ({ row }) => row.original.respondentName ?? "—",
      },
      {
        accessorKey: "mobileNumber",
        id: "mobile",
        header: "Mobile",
        cell: ({ row }) => row.original.mobileNumber ?? "—",
      },
      {
        id: "location",
        header: "Ward / ULB",
        cell: ({ row }) => [row.original.ward?.wardName, row.original.ulb?.name].filter(Boolean).join(", ") || "—",
      },
      {
        id: "district",
        header: "District",
        cell: ({ row }) => row.original.district?.name ?? "—",
      },
      {
        id: "surveyor",
        header: "Surveyor",
        cell: ({ row }) => row.original.assignedTo?.fullName ?? row.original.createdBy?.fullName ?? "—",
      },
      {
        accessorKey: "surveyStatus",
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.surveyStatus} />,
      },
      {
        accessorKey: "qcStatus",
        id: "qc",
        header: "QC",
        cell: ({ row }) => (row.original.qcStatus ? <StatusBadge status={row.original.qcStatus} /> : "—"),
      },
      {
        accessorKey: "createdAt",
        id: "created",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/surveys/${row.original.id}`}>Open</Link>
          </Button>
        ),
      },
    ],
    []
  )

  const persistableFilters = useMemo(
    () => ({
      surveyStatus: filters.surveyStatus,
      qcStatus: filters.qcStatus,
      stateId: filters.stateId,
      districtId: filters.districtId,
      ulbId: filters.ulbId,
      wardId: filters.wardId,
      surveyorId: filters.surveyorId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      mobile: filters.mobile,
    }),
    [filters]
  )

  const onFiltersChange = (next: SurveyRegistryFiltersState) => {
    setFilters(next)
    setPage(1)
    setRowSelection({})
  }

  const runBulkApprove = async () => {
    if (!selectedIds.length) return
    try {
      const result = await mutations.bulkApprove.mutateAsync(selectedIds)
      toast.success(`Approved ${result.succeeded.length} · failed ${result.failed.length}`)
      setRowSelection({})
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runBulkReject = async () => {
    if (!selectedIds.length) return
    if (!qcRemarks.trim()) {
      toast.error("QC remarks are required for rejection")
      return
    }
    try {
      const result = await mutations.bulkReject.mutateAsync({ ids: selectedIds, qcRemarks: qcRemarks.trim() })
      toast.success(`Rejected ${result.succeeded.length} · failed ${result.failed.length}`)
      setRejectOpen(false)
      setQcRemarks("")
      setRowSelection({})
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runBulkExport = async () => {
    if (!selectedIds.length) return
    try {
      const result = await mutations.bulkExport.mutateAsync(selectedIds)
      toast.success(`Export queued (${result.selectedCount} surveys)`)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Survey registry"
        description="Filter, review, and act on municipal property surveys"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SavedViewsMenu
              currentFilters={persistableFilters}
              currentColumns={columnVisibility as Record<string, boolean>}
              onApply={applyView}
            />
            {hasPermission("survey:create") ? (
              <Button asChild size="sm">
                <Link href="/surveys/new">
                  <Plus className="size-3.5" />
                  New survey
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <WardCommandCards
        wards={wardStats}
        selectedWardId={filters.wardId || undefined}
        isLoading={wardsLoading}
        onSelect={(wardId) =>
          onFiltersChange({
            ...filters,
            wardId: wardId ?? "",
          })
        }
      />

      <SurveyRegistryFilters
        filters={filters}
        onChange={onFiltersChange}
        onReset={() => onFiltersChange(emptyRegistryFilters())}
      />

      {isError ? <p className="text-sm text-destructive">Failed to load surveys</p> : null}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search property ID, respondent…"
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row.id}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        footerToolbar={
          selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">{selectedIds.length} selected</span>
              {hasPermission("survey:approve") ? (
                <Button
                  size="sm"
                  className="h-8"
                  disabled={mutations.bulkApprove.isPending}
                  onClick={() => void runBulkApprove()}
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </Button>
              ) : null}
              {hasPermission("survey:reject") ? (
                <Button size="sm" variant="destructive" className="h-8" onClick={() => setRejectOpen(true)}>
                  <XCircle className="size-3.5" />
                  Reject
                </Button>
              ) : null}
              {hasPermission("report:export") ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={mutations.bulkExport.isPending}
                  onClick={() => void runBulkExport()}
                >
                  <Download className="size-3.5" />
                  Export
                </Button>
              ) : null}
            </div>
          ) : null
        }
        emptyTitle="No surveys found"
        emptyDescription="Adjust filters or create a new survey."
        pagination={
          data?.meta
            ? {
                page: data.meta.page,
                totalPages: data.meta.totalPages,
                total: data.meta.total,
                onPageChange: setPage,
                pageSize: limit,
                onPageSizeChange: (size) => {
                  setLimit(size)
                  setPage(1)
                },
                pageSizeOptions: [20, 50, 100],
              }
            : undefined
        }
      />

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.length} surveys</DialogTitle>
            <DialogDescription>QC remarks are required and will be applied to every selected survey.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={qcRemarks}
            onChange={(e) => setQcRemarks(e.target.value)}
            placeholder="Describe why these surveys are being rejected…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={mutations.bulkReject.isPending}
              onClick={() => void runBulkReject()}
            >
              Reject selected
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
        <div className="space-y-5">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <SurveysPageContent />
    </Suspense>
  )
}
