"use client"

import { DataTable, DataTableSelectColumn } from "@/components/data-table/data-table"
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useSurveyMutations, useSurveys } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SurveyListItem } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { CheckCircle2, Clock3, Eye, RotateCcw, XCircle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { toast } from "sonner"

type Pipeline = "pending" | "review" | "approved" | "returned"

const PIPELINE_CONFIG: Record<
  Pipeline,
  { label: string; surveyStatus?: string; qcStatus?: string; description: string }
> = {
  pending: {
    label: "Pending",
    surveyStatus: "SUBMITTED",
    qcStatus: "PENDING",
    description: "Submitted surveys awaiting QC review",
  },
  review: {
    label: "In review",
    surveyStatus: "SUBMITTED",
    description: "All submitted items in the QC pipeline",
  },
  approved: {
    label: "Approved",
    surveyStatus: "APPROVED",
    qcStatus: "APPROVED",
    description: "QC-approved surveys",
  },
  returned: {
    label: "Returned",
    surveyStatus: "REJECTED",
    qcStatus: "REJECTED",
    description: "Returned to field with remarks",
  },
}

function QcPortalContent() {
  const searchParams = useSearchParams()
  const initialPipeline = (searchParams.get("pipeline") as Pipeline) || "pending"
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")
  const canReject = hasPermission("survey:reject")

  const [pipeline, setPipeline] = useState<Pipeline>(PIPELINE_CONFIG[initialPipeline] ? initialPipeline : "pending")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [rejectOpen, setRejectOpen] = useState(false)
  const [qcRemarks, setQcRemarks] = useState("")
  const [drawerSurvey, setDrawerSurvey] = useState<SurveyListItem | null>(null)

  const config = PIPELINE_CONFIG[pipeline]
  const query = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      surveyStatus: config.surveyStatus,
      qcStatus: config.qcStatus,
      sortBy: "submittedAt",
      sortOrder: "asc",
    }),
    [page, search, config]
  )

  const { data, isLoading, isError } = useSurveys(query)
  const mutations = useSurveyMutations()

  const selectedIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => id),
    [rowSelection]
  )

  const columns = useMemo<ColumnDef<SurveyListItem>[]>(
    () => [
      DataTableSelectColumn<SurveyListItem>(),
      {
        accessorKey: "propertyId",
        header: "Property ID",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer font-medium text-primary hover:underline"
            onClick={() => setDrawerSurvey(row.original)}
          >
            {row.original.propertyId}
          </button>
        ),
      },
      {
        accessorKey: "respondentName",
        header: "Respondent",
        cell: ({ row }) => row.original.respondentName ?? "—",
      },
      {
        id: "location",
        header: "Ward / ULB",
        cell: ({ row }) => [row.original.ward?.wardName, row.original.ulb?.name].filter(Boolean).join(", ") || "—",
      },
      {
        id: "surveyor",
        header: "Surveyor",
        cell: ({ row }) => row.original.assignedTo?.fullName ?? row.original.createdBy?.fullName ?? "—",
      },
      {
        accessorKey: "surveyStatus",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.surveyStatus} />,
      },
      {
        accessorKey: "qcStatus",
        header: "QC",
        cell: ({ row }) => (row.original.qcStatus ? <StatusBadge status={row.original.qcStatus} /> : "—"),
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => (row.original.submittedAt ? new Date(row.original.submittedAt).toLocaleString() : "—"),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => setDrawerSurvey(row.original)}>
            <Eye className="size-3.5" />
            Review
          </Button>
        ),
      },
    ],
    []
  )

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
      toast.error("QC remarks are required for returns")
      return
    }
    try {
      const result = await mutations.bulkReject.mutateAsync({ ids: selectedIds, qcRemarks: qcRemarks.trim() })
      toast.success(`Returned ${result.succeeded.length} · failed ${result.failed.length}`)
      setRejectOpen(false)
      setQcRemarks("")
      setRowSelection({})
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  if (!canApprove && !canReject) {
    return (
      <EmptyState
        title="QC Portal unavailable"
        description="You need survey approval or rejection permissions to use the QC portal."
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="QC Command Center"
        description="Pipeline review for pending, approved, and returned municipal surveys"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(PIPELINE_CONFIG) as Pipeline[]).map((key) => {
          const item = PIPELINE_CONFIG[key]
          const active = pipeline === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPipeline(key)
                setPage(1)
                setRowSelection({})
              }}
              className={cn(
                "cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                {key === "pending" ? <Clock3 className="size-4 text-amber-600" /> : null}
                {key === "approved" ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
                {key === "returned" ? <RotateCcw className="size-4 text-orange-600" /> : null}
                {key === "review" ? <Eye className="size-4 text-blue-600" /> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </button>
          )
        })}
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-medium">{config.label} queue</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
            </div>
            <Tabs
              value={pipeline}
              onValueChange={(value) => {
                setPipeline(value as Pipeline)
                setPage(1)
                setRowSelection({})
              }}
            >
              <TabsList>
                {(Object.keys(PIPELINE_CONFIG) as Pipeline[]).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {PIPELINE_CONFIG[key].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError ? <p className="text-sm text-destructive">Failed to load QC queue</p> : null}

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
            stickyFirstColumns={2}
            footerToolbar={
              selectedIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
                  {canApprove ? (
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={mutations.bulkApprove.isPending}
                      onClick={() => void runBulkApprove()}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Bulk approve
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button size="sm" variant="destructive" className="h-8" onClick={() => setRejectOpen(true)}>
                      <XCircle className="size-3.5" />
                      Bulk return
                    </Button>
                  ) : null}
                </div>
              ) : null
            }
            emptyTitle="No surveys in this pipeline"
            emptyDescription="Select another stage or wait for new submissions."
            pagination={
              data?.meta
                ? {
                    page: data.meta.page,
                    totalPages: data.meta.totalPages,
                    total: data.meta.total,
                    onPageChange: setPage,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Sheet open={Boolean(drawerSurvey)} onOpenChange={(open) => !open && setDrawerSurvey(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{drawerSurvey?.propertyId}</SheetTitle>
            <SheetDescription>QC review drawer with status, location, and approval actions</SheetDescription>
          </SheetHeader>
          {drawerSurvey ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 rounded-xl border p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={drawerSurvey.surveyStatus} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">QC</span>
                  {drawerSurvey.qcStatus ? <StatusBadge status={drawerSurvey.qcStatus} /> : <span>—</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Respondent</span>
                  <span className="font-medium">{drawerSurvey.respondentName ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-right font-medium">
                    {[drawerSurvey.ward?.wardName, drawerSurvey.ulb?.name].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Surveyor</span>
                  <span className="font-medium">
                    {drawerSurvey.assignedTo?.fullName ?? drawerSurvey.createdBy?.fullName ?? "—"}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium">Approval timeline</p>
                <ol className="mt-3 space-y-3 border-l pl-4 text-sm">
                  <li>
                    <p className="font-medium">Created</p>
                    <p className="text-xs text-muted-foreground">{new Date(drawerSurvey.createdAt).toLocaleString()}</p>
                  </li>
                  <li>
                    <p className="font-medium">Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      {drawerSurvey.submittedAt ? new Date(drawerSurvey.submittedAt).toLocaleString() : "Not submitted"}
                    </p>
                  </li>
                  <li>
                    <p className="font-medium">Current QC</p>
                    <p className="text-xs text-muted-foreground">{drawerSurvey.qcStatus ?? "Pending"}</p>
                  </li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/surveys/${drawerSurvey.id}`}>Open full record</Link>
                </Button>
                {canApprove && drawerSurvey.surveyStatus === "SUBMITTED" ? (
                  <Button
                    variant="outline"
                    disabled={mutations.approve.isPending}
                    onClick={async () => {
                      try {
                        await mutations.approve.mutateAsync(drawerSurvey.id)
                        toast.success("Survey approved")
                        setDrawerSurvey(null)
                      } catch (error) {
                        toast.error(getApiErrorMessage(error))
                      }
                    }}
                  >
                    Approve
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {selectedIds.length} surveys</DialogTitle>
            <DialogDescription>QC remarks are required and will be applied to every selected survey.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={qcRemarks}
            onChange={(e) => setQcRemarks(e.target.value)}
            placeholder="Describe why these surveys are being returned…"
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
              Return selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function QcPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <QcPortalContent />
    </Suspense>
  )
}
