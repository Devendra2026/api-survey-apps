"use client"

import { DataTable } from "@/components/data-table/data-table"
import { apiGet } from "@/lib/api/client"
import type { QcRegistryCounts, QcRegistryRecord, QcRegistryTab, QcSurveyDetail } from "@/lib/api/types"
import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, Search } from "lucide-react"
import Link from "next/link"

const TAB_ITEMS: Array<{
  id: QcRegistryTab
  label: string
  countKey: keyof QcRegistryCounts
  variant: "accent" | "pill" | "muted" | "outline"
}> = [
  { id: "pendingApproved", label: "Pending & Approved", countKey: "pendingApproved", variant: "accent" },
  { id: "pendingQc", label: "Pending QC", countKey: "pendingQc", variant: "pill" },
  { id: "approved", label: "Approved", countKey: "approved", variant: "pill" },
  { id: "returned", label: "Returned", countKey: "returned", variant: "muted" },
  { id: "parcelShared", label: "Parcel shared", countKey: "parcelShared", variant: "muted" },
  { id: "all", label: "All", countKey: "all", variant: "outline" },
]

function statusTone(status: string) {
  const key = status.toLowerCase()
  if (key.includes("approved")) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  if (key.includes("pending")) return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
  if (key.includes("return") || key.includes("reject")) return "bg-rose-500/10 text-rose-700 dark:text-rose-400"
  return "bg-slate-500/10 text-slate-600 dark:text-slate-300"
}

function propertyUseLabel(value?: string | null) {
  if (!value) return "—"
  switch (value) {
    case "RESIDENTIAL":
      return "Residential (R)"
    case "COMMERCIAL":
      return "Commercial (C)"
    case "OPEN_LAND":
      return "Open land (P)"
    case "RELIGIOUS_PROPERTY":
      return "Religious"
    case "MIX_PROPERTY":
      return "Mixed"
    default:
      return value
  }
}

function ReviewActionButton({ surveyId }: { surveyId: string }) {
  const queryClient = useQueryClient()

  const prefetch = () => {
    void queryClient.prefetchQuery({
      queryKey: ["qc", "survey", surveyId],
      queryFn: () => apiGet<QcSurveyDetail>(`/qc/survey/${encodeURIComponent(surveyId)}`),
      staleTime: 60_000,
    })
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-8 cursor-pointer rounded-full bg-teal-600/10 text-teal-800 hover:bg-teal-600/20 dark:text-teal-300"
      asChild
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      <Link href={`/qc/review/${encodeURIComponent(surveyId)}`}>
        <Eye className="size-3.5" />
        Review
      </Link>
    </Button>
  )
}

export function buildQcRegistryColumns(page: number, limit: number): ColumnDef<QcRegistryRecord>[] {
  return [
    {
      id: "sno",
      header: "S. No",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{(page - 1) * limit + row.index + 1}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => <ReviewActionButton surveyId={row.original.id} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={cn("rounded-full font-medium", statusTone(row.original.status))}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: "surveyorName",
      header: "Surveyor Name",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.surveyorName}</span>,
    },
    {
      accessorKey: "propertyId",
      header: "Property ID",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.propertyId}</span>,
    },
    {
      accessorKey: "wardNumber",
      header: "Ward Number",
      cell: ({ row }) => <span className="tabular-nums">{row.original.wardNumber}</span>,
    },
    {
      accessorKey: "parcelNumber",
      header: "Parcel Number",
      cell: ({ row }) => <span className="tabular-nums">{row.original.parcelNumber}</span>,
    },
    {
      accessorKey: "propertyUse",
      header: "Property Use",
      cell: ({ row }) => (
        <Badge variant="outline" className="rounded-full font-normal">
          {propertyUseLabel(row.original.propertyUse)}
        </Badge>
      ),
    },
    {
      accessorKey: "ownerName",
      header: "Owner Name",
      cell: ({ row }) => (
        <span className={cn(row.original.ownerName === "—" && "text-muted-foreground")}>{row.original.ownerName}</span>
      ),
    },
    {
      accessorKey: "mobile",
      header: "Mobile",
      cell: ({ row }) => (
        <span className={cn("tabular-nums", row.original.mobile === "—" && "text-muted-foreground")}>
          {row.original.mobile}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.date}</span>,
    },
  ]
}

export function QcRegistryTable({
  data,
  isLoading,
  isError,
  search,
  onSearchChange,
  tab,
  onTabChange,
  counts,
  page,
  limit,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  data: QcRegistryRecord[]
  isLoading?: boolean
  isError?: boolean
  search: string
  onSearchChange: (value: string) => void
  tab: QcRegistryTab
  onTabChange: (tab: QcRegistryTab) => void
  counts?: QcRegistryCounts
  page: number
  limit: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const columns = buildQcRegistryColumns(page, limit)

  return (
    <Card className="border-slate-100/80 bg-card/80 shadow-sm backdrop-blur dark:border-slate-800/80">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-foreground uppercase">QC Review Registry</p>
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString()} records in selected tab - click Review to verify
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search property ID, owner, parcel, or ward..."
            className="h-9 border-slate-200/80 bg-background/70 pl-9 backdrop-blur dark:border-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {TAB_ITEMS.map((item) => {
            const count = counts?.[item.countKey] ?? 0
            const active = tab === item.id
            const isMutedEmpty = item.variant === "muted" && count === 0 && !active

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active && item.variant === "accent" && "border-teal-600 bg-teal-600 text-white shadow-sm",
                  active &&
                    item.variant !== "accent" &&
                    "border-teal-600 bg-teal-600/15 text-teal-800 dark:text-teal-200",
                  !active &&
                    item.variant === "outline" &&
                    "border-slate-300 bg-transparent text-muted-foreground hover:bg-muted dark:border-slate-700",
                  !active &&
                    item.variant === "pill" &&
                    "border-slate-200 bg-background text-muted-foreground hover:bg-muted dark:border-slate-800",
                  !active &&
                    item.variant === "muted" &&
                    "border-slate-200 bg-muted/40 text-muted-foreground/70 dark:border-slate-800",
                  !active &&
                    item.variant === "accent" &&
                    "border-slate-200 bg-background text-muted-foreground hover:bg-muted dark:border-slate-800",
                  isMutedEmpty && "opacity-60"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active && item.variant === "accent" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                    active && item.variant !== "accent" && "bg-teal-600/20 text-teal-800 dark:text-teal-200"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {isError ? <p className="text-sm text-destructive">Failed to load QC review registry</p> : null}

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          emptyTitle="No QC records found"
          emptyDescription="Adjust scope, search, or pipeline tab to see registry records."
          stickyFirstColumns={2}
          pagination={{
            page,
            totalPages,
            total,
            onPageChange,
            pageSize: limit,
            onPageSizeChange,
            pageSizeOptions: [20, 50, 100],
          }}
        />
      </CardContent>
    </Card>
  )
}
