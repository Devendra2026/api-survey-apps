"use client"

import { useMemo, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Download } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
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
import { PageHeader, StatusBadge, EmptyState } from "@/components/shared/page-elements"
import { exportReport, useReports } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Survey listings and exportable reports for your tenant"
        actions={
          hasPermission("report:export") ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>
                <Download className="size-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
                PDF
              </Button>
            </div>
          ) : null
        }
      />

      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="SUBMITTED">Submitted</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ULB</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : data?.items.length ? (
              data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.propertyId}</TableCell>
                  <TableCell><StatusBadge status={row.surveyStatus} /></TableCell>
                  <TableCell>{row.ulb?.name ?? "—"}</TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}><EmptyState title="No report data" /></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data?.meta ? (
        <div className="flex justify-between">
          <p className="text-muted-foreground text-sm">{data.meta.total} records</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
