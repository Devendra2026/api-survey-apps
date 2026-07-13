"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useSurveys } from "@/hooks/use-api"
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useUiStore } from "@/stores/app-store"
import { useAuthStore } from "@/stores/app-store"
import type { SurveyListItem } from "@/lib/api/types"

export default function SurveysPage() {
  const globalSearch = useUiStore((s) => s.globalSearch)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      search: search || globalSearch || undefined,
      surveyStatus: status === "all" ? undefined : status,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    [page, search, globalSearch, status]
  )

  const { data, isLoading, isError } = useSurveys(query)

  const columns = useMemo<ColumnDef<SurveyListItem>[]>(
    () => [
      {
        accessorKey: "propertyId",
        header: "Property ID",
        cell: ({ row }) => (
          <Link href={`/surveys/${row.original.id}`} className="text-primary font-medium hover:underline">
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
        id: "location",
        header: "Ward / ULB",
        cell: ({ row }) =>
          [row.original.ward?.wardName, row.original.ulb?.name].filter(Boolean).join(", ") || "—",
      },
      {
        accessorKey: "surveyStatus",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.surveyStatus} />,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    []
  )

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surveys"
        description="Manage municipal property tax survey records"
        actions={
          hasPermission("survey:create") ? (
            <Button asChild>
              <Link href="/surveys/new">
                <Plus className="size-4" />
                New survey
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search property ID, respondent..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="REOPENED">Reopened</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                  Loading surveys...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-destructive h-24 text-center">
                  Failed to load surveys
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState title="No surveys found" description="Adjust filters or create a new survey." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data?.meta ? (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
