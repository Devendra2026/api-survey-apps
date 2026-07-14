"use client"

import { DataTable } from "@/components/data-table/data-table"
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { exportReport, useReports } from "@/hooks/use-api"
import type { SurveyListItem } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type ReportTemplate = {
  id: string
  title: string
  description: string
  reportType: string
  formats: Array<"xlsx" | "csv" | "pdf">
  government?: boolean
}

const TEMPLATES: ReportTemplate[] = [
  {
    id: "survey-data",
    title: "Survey Data tax worksheet",
    description: "Government single-sheet tax demand workbook with merged floor headers",
    reportType: "survey_data",
    formats: ["xlsx"],
    government: true,
  },
  {
    id: "nagar-panchayat",
    title: "Nagar Panchayat report",
    description: "Bakewar-compatible Survey Data flat export (~45 columns)",
    reportType: "nagar_panchayat",
    formats: ["xlsx"],
    government: true,
  },
  {
    id: "convex-full",
    title: "Convex full export",
    description: "Multi-sheet round-trip: Surveys, CoOwners, Floors, Photos, Guide",
    reportType: "convex_full",
    formats: ["xlsx"],
  },
  {
    id: "qc-final",
    title: "QC Final report",
    description: "QC completion workbook for ward/municipality sign-off",
    reportType: "qc_final",
    formats: ["xlsx"],
    government: true,
  },
  {
    id: "ward",
    title: "Ward report",
    description: "Filtered survey listing scoped by ward hierarchy",
    reportType: "ward",
    formats: ["xlsx", "csv", "pdf"],
  },
  {
    id: "ulb",
    title: "Municipality report",
    description: "ULB / municipality operational export",
    reportType: "ulb",
    formats: ["xlsx", "csv", "pdf"],
  },
  {
    id: "district",
    title: "District report",
    description: "District-level survey package",
    reportType: "district",
    formats: ["xlsx", "csv", "pdf"],
  },
  {
    id: "surveys",
    title: "Survey listing",
    description: "Generic survey registry export for dashboards and audits",
    reportType: "surveys",
    formats: ["xlsx", "csv", "pdf"],
  },
]

export default function ReportsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { getToken } = useAuth()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("all")
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]?.id ?? "survey-data")
  const [exporting, setExporting] = useState<string | null>(null)

  const query = useMemo(
    () => ({
      page,
      limit: 20,
      surveyStatus: status === "all" ? undefined : status,
    }),
    [page, status]
  )

  const { data, isLoading } = useReports(query)
  const template = TEMPLATES.find((item) => item.id === selectedTemplate) ?? TEMPLATES[0]!

  async function handleExport(format: "xlsx" | "csv" | "pdf", reportType = template.reportType) {
    if (!hasPermission("report:export")) return
    const key = `${reportType}:${format}`
    setExporting(key)
    try {
      const token = await getToken()
      const params: Record<string, string> = {
        reportType,
        sync: "true",
      }
      if (status !== "all") params.surveyStatus = status
      const url = await exportReport(format, params)
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = `${reportType}-report.${format === "xlsx" ? "xlsx" : format}`
      a.click()
      URL.revokeObjectURL(href)
      toast.success(`${reportType} ${format.toUpperCase()} downloaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(null)
    }
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
        id: "ward",
        header: "Ward",
        cell: ({ row }) => row.original.ward?.wardName ?? "—",
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

  if (!hasPermission("report:view")) {
    return <EmptyState title="Reports unavailable" description="You do not have permission to view reports." />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report builder"
        description="Premium catalog for government Excel packs, ward/municipality exports, and dashboard downloads"
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <CardDescription>Select a government or operational report, then download in one click</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((item) => {
              const active = item.id === selectedTemplate
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTemplate(item.id)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.government ? <Badge variant="secondary">Gov</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{template.title}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>

            {hasPermission("report:export") ? (
              <div className="flex flex-wrap gap-2">
                {template.formats.map((format) => {
                  const busy = exporting === `${template.reportType}:${format}`
                  return (
                    <Button
                      key={format}
                      size="sm"
                      variant={format === "xlsx" ? "default" : "outline"}
                      disabled={Boolean(exporting)}
                      onClick={() => void handleExport(format)}
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                      {format.toUpperCase()}
                    </Button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Export permission required for downloads.</p>
            )}

            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <FileSpreadsheet className="size-3.5" />
                Saved / scheduled reports
              </p>
              <p className="mt-1">
                Template selection is remembered in-session. Scheduled report jobs can be wired to ExportJob once cron
                credentials are configured.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        toolbar={<p className="text-xs text-muted-foreground">Preview rows for the current tenant and status filter</p>}
        emptyTitle="No report data"
        stickyFirstColumns={1}
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
