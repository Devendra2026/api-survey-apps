"use client"

import { DataTable } from "@/components/data-table/data-table"
import type { SurveyRegistryCounts, SurveyRegistryRecord, SurveyRegistryTab } from "@/lib/api/types"
import { formatParcelDisplay } from "@/lib/format-parcel"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Progress } from "@workspace/ui/components/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, Loader2, Search, X } from "lucide-react"
import Link from "next/link"

export type SurveyRegistrySearchField = "all" | "owner" | "parcel" | "propertyId"

const SEARCH_PLACEHOLDER = "Search by Parcel Number, Property ID, or Owner Name"

const SEARCH_FIELD_OPTIONS: Array<{ value: SurveyRegistrySearchField; label: string }> = [
  { value: "all", label: "All" },
  { value: "owner", label: "Owner name" },
  { value: "parcel", label: "Parcel number" },
  { value: "propertyId", label: "Property ID" },
]

const TAB_ITEMS: Array<{ id: SurveyRegistryTab; label: string; countKey: keyof SurveyRegistryCounts }> = [
  { id: "all", label: "All", countKey: "all" },
  { id: "draft", label: "Draft", countKey: "draft" },
  { id: "submitted", label: "Submitted", countKey: "submitted" },
  { id: "qcPending", label: "QC Pending", countKey: "qcPending" },
  { id: "qcApproved", label: "QC Approved", countKey: "qcApproved" },
  { id: "rejected", label: "Rejected", countKey: "rejected" },
]

function statusTone(status: string) {
  const key = status.toLowerCase()
  if (key.includes("approved")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (key.includes("draft") || key.includes("progress")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  if (key.includes("submitted")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
  if (key.includes("reject")) return "bg-rose-500/10 text-rose-600 dark:text-rose-400"
  return "bg-slate-500/10 text-slate-600 dark:text-slate-300"
}

export function buildRegistryColumns(page: number, limit: number): ColumnDef<SurveyRegistryRecord>[] {
  return [
    {
      id: "sno",
      header: "S.No",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{(page - 1) * limit + row.index + 1}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" className="h-8 cursor-pointer" asChild>
          <Link href={`/surveys/${row.original.id}`}>
            <Eye className="size-3.5" />
            View
          </Link>
        </Button>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={cn("rounded-full font-medium", statusTone(row.original.status))}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: "progress",
      header: "Survey Progress",
      cell: ({ row }) => (
        <div className="flex min-w-28 items-center gap-2">
          <Progress value={row.original.progress} className="h-1.5 flex-1" />
          <span className="w-9 text-right text-xs font-medium text-muted-foreground tabular-nums">
            {row.original.progress}%
          </span>
        </div>
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
      cell: ({ row }) => <span className="tabular-nums">{formatParcelDisplay(row.original.parcelNumber)}</span>,
    },
    {
      accessorKey: "ownerName",
      header: "Owner Name",
      cell: ({ row }) => row.original.ownerName,
    },
    {
      accessorKey: "surveyDate",
      header: "Survey Date",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.surveyDate}</span>,
    },
  ]
}

export function SurveyRegistryTable({
  data,
  isLoading,
  isError,
  search,
  onSearchChange,
  searchField,
  onSearchFieldChange,
  tab,
  onTabChange,
  counts,
  page,
  limit,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
  toolbar,
}: {
  data: SurveyRegistryRecord[]
  isLoading?: boolean
  isError?: boolean
  search: string
  onSearchChange: (value: string) => void
  searchField: SurveyRegistrySearchField
  onSearchFieldChange: (value: SurveyRegistrySearchField) => void
  tab: SurveyRegistryTab
  onTabChange: (tab: SurveyRegistryTab) => void
  counts?: SurveyRegistryCounts
  page: number
  limit: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  toolbar?: React.ReactNode
}) {
  const columns = buildRegistryColumns(page, limit)

  return (
    <Card className="border-slate-100 shadow-sm dark:border-slate-800">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={searchField} onValueChange={(v) => onSearchFieldChange(v as SurveyRegistrySearchField)}>
            <SelectTrigger className="h-9 w-full border-slate-200/80 bg-background/70 sm:w-44 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_FIELD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative max-w-md min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className={cn(
                "h-9 border-slate-200/80 bg-background/70 pl-9 backdrop-blur dark:border-slate-800",
                (search || isLoading) && "pr-9"
              )}
              aria-label={SEARCH_PLACEHOLDER}
            />
            {isLoading && search ? (
              <Loader2
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {TAB_ITEMS.map((item) => {
            const count = counts?.[item.countKey] ?? 0
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                    : "border-slate-200 bg-background text-muted-foreground hover:bg-muted dark:border-slate-800"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {isError ? <p className="text-sm text-destructive">Failed to load survey registry</p> : null}

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          toolbar={toolbar}
          emptyTitle={search.trim() ? "No results found" : "No surveys found"}
          emptyDescription={
            search.trim()
              ? "Try a different parcel number, property ID, or owner name."
              : "Adjust scope or filters to see registry records."
          }
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
