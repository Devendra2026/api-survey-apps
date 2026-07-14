"use client"

import { DataTable } from "@/components/data-table/data-table"
import { PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { exportReport, useReports } from "@/hooks/use-api"
import type { SurveyListItem } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

export default function ReportsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { getToken } = useAuth()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("all")

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      surveyStatus: status === "all" ? undefined : status,
    }),
    [page, status]
  )

  const { data, isLoading } = useReports(query)

  async function handleExport(format: "xlsx" | "csv" | "pdf") {
    if (!hasPermission("report:export")) return
    const token = await getToken()
    const params: Record<string, string> = {}
    if (status !== "all") params.surveyStatus = status
    const url = await exportReport(format, params)
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = `survey-report.${format === "xlsx" ? "xlsx" : format}`
    a.click()
    URL.revokeObjectURL(href)
  }

  const columns = useMemo<ColumnDef<SurveyListItem>[]>(
    () => [
      {
        accessorKey: "propertyId",
        id: "propertyId",
        header: "Property ID",
        cell: ({ row }) => <span className="font-medium">{row.original.propertyId}</span>,
      },
      {
        accessorKey: "surveyStatus",
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.surveyStatus} />,
      },
      {
        id: "ulb",
        header: "ULB",
        cell: ({ row }) => row.original.ulb?.name ?? "—",
      },
      {
        accessorKey: "createdAt",
        id: "created",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    []
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Survey listings and exportable reports for your tenant"
        actions={
          hasPermission("report:export") ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void handleExport("xlsx")}>
                <Download className="size-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExport("csv")}>
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")}>
                PDF
              </Button>
            </div>
          ) : null
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        toolbar={
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-44">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
        emptyTitle="No report data"
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
