"use client"

import { DataTable } from "@/components/data-table/data-table"
import { PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useSurveys } from "@/hooks/use-api"
import type { SurveyListItem } from "@/lib/api/types"
import { useAuthStore, useUiStore } from "@/stores/app-store"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

function SurveysPageContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get("surveyStatus") ?? "all"
  const globalSearch = useUiStore((s) => s.globalSearch)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(initialStatus)
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
        id: "location",
        header: "Ward / ULB",
        cell: ({ row }) => [row.original.ward?.wardName, row.original.ulb?.name].filter(Boolean).join(", ") || "—",
      },
      {
        accessorKey: "surveyStatus",
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.surveyStatus} />,
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Surveys"
        description="Manage municipal property tax survey records"
        actions={
          hasPermission("survey:create") ? (
            <Button asChild size="sm">
              <Link href="/surveys/new">
                <Plus className="size-3.5" />
                New survey
              </Link>
            </Button>
          ) : null
        }
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
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-44">
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
              }
            : undefined
        }
      />
    </div>
  )
}

export default function SurveysPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <SurveysPageContent />
    </Suspense>
  )
}
