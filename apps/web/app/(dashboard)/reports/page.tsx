"use client"

import { ReportScopeFiltersPanel, type ReportScopeState } from "@/components/reports/report-scope-filters"
import { EmptyState } from "@/components/shared/page-elements"
import { exportReport, useCommandCenterKPIs, useDashboardSummary, useUlbs } from "@/hooks/use-api"
import type { CommandCenterFilters } from "@/lib/api/types"
import {
  downloadFromUrl,
  enqueueReportExport,
  getExportJobDownload,
  isSyncExportCapError,
  waitForExportJob,
} from "@/lib/reports/export-download"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  Loader2,
  Save,
  ScrollText,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

const SAVED_REPORTS = [
  { id: "1", name: "Monthly ULB Summary", type: "PDF", updated: "2 days ago" },
  { id: "2", name: "Surveyor Performance Q1", type: "Excel", updated: "1 week ago" },
  { id: "3", name: "Ward Coverage Analysis", type: "Dashboard", updated: "2 weeks ago" },
] as const

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

function ScopeMetricCard({
  label,
  value,
  icon: Icon,
  iconTone,
  isLoading,
}: {
  label: string
  value: number | null
  icon: LucideIcon
  iconTone: string
  isLoading?: boolean
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm transition-colors duration-200 hover:border-primary/20">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
          <span className={cn("flex size-9 items-center justify-center rounded-xl", iconTone)}>
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        {isLoading ? (
          <Skeleton className="mt-3 h-8 w-20" />
        ) : (
          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {value === null ? "—" : formatNum(value)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ReportActionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm transition-colors duration-200 hover:border-primary/25">
      <CardHeader className="pb-3">
        <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">{children}</CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { getToken } = useAuth()
  const [filters, setFilters] = useState<ReportScopeState>({})
  const [exporting, setExporting] = useState<string | null>(null)

  const onFiltersChange = useCallback((next: ReportScopeState) => {
    setFilters(next)
  }, [])

  const commandCenterFilters = useMemo<CommandCenterFilters>(
    () => ({
      districtId: filters.districtId,
      ulbId: filters.ulbId,
      wardId: filters.wardId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      month: filters.month,
    }),
    [filters]
  )

  const kpisQuery = useCommandCenterKPIs(
    commandCenterFilters,
    hasPermission("survey:view") || hasPermission("report:view")
  )
  const dashboardQuery = useDashboardSummary()
  const { data: ulbs } = useUlbs(filters.districtId)

  const municipalityCount = useMemo(() => {
    if (filters.districtId) return ulbs?.items?.length ?? 0
    const byUlb = dashboardQuery.data?.byUlb
    return byUlb?.length ?? null
  }, [filters.districtId, ulbs?.items?.length, dashboardQuery.data?.byUlb])

  const surveysCount =
    kpisQuery.data?.totalProperties ?? dashboardQuery.data?.totalSurveys ?? dashboardQuery.data?.total ?? null
  const approvedCount =
    kpisQuery.data?.approvedCompleted ?? kpisQuery.data?.qcApproved ?? dashboardQuery.data?.approvedQc ?? null
  const rejectedCount =
    kpisQuery.data?.returned ?? dashboardQuery.data?.rejections ?? dashboardQuery.data?.rejected ?? null

  const metricsLoading = (kpisQuery.isLoading || dashboardQuery.isLoading) && surveysCount === null

  const scopeParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (filters.stateId) params.stateId = filters.stateId
    if (filters.districtId) params.districtId = filters.districtId
    if (filters.ulbId) params.ulbId = filters.ulbId
    if (filters.wardId) params.wardId = filters.wardId
    if (filters.dateFrom) params.dateFrom = filters.dateFrom
    if (filters.dateTo) params.dateTo = filters.dateTo
    return params
  }, [filters])

  async function readExportErrorMessage(response: Response): Promise<string> {
    const fallback = `Export failed (${response.status})`
    try {
      const text = await response.text()
      if (!text) return fallback
      const data = JSON.parse(text) as {
        success?: boolean
        message?: string | string[]
        error?: string
        errors?: Array<string | { message?: string }>
      }
      if (typeof data.message === "string" && data.message.trim()) return data.message
      if (Array.isArray(data.message) && data.message.length > 0) {
        return data.message.filter((m) => typeof m === "string").join("; ") || fallback
      }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0]
        if (typeof first === "string") return first
        if (first && typeof first.message === "string") return first.message
      }
      if (typeof data.error === "string" && data.error.trim()) return data.error
      return text.slice(0, 240) || fallback
    } catch {
      return fallback
    }
  }

  async function downloadBlob(response: Response, reportType: string, format: "xlsx" | "csv" | "pdf") {
    const blob = await response.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = `${reportType}-report.${format === "xlsx" ? "xlsx" : format}`
    a.click()
    URL.revokeObjectURL(href)
  }

  async function exportViaBackgroundJob(format: "xlsx" | "csv" | "pdf", reportType: string) {
    toast.info("Large export — generating in the background…")
    const enqueued = await enqueueReportExport(format, {
      ...scopeParams,
      reportType,
    })
    const job = await waitForExportJob(enqueued.jobId)
    const download = await getExportJobDownload(job.id)
    await downloadFromUrl(
      download.url,
      download.filename || `${reportType}-export.${format === "xlsx" ? "xlsx" : format}`
    )
  }

  async function handleExport(format: "xlsx" | "csv" | "pdf", reportType: string) {
    if (!hasPermission("report:export")) {
      toast.error("Export permission required")
      return
    }
    const key = `${reportType}:${format}`
    setExporting(key)
    try {
      const knownLarge = typeof surveysCount === "number" && surveysCount > 450

      if (knownLarge) {
        await exportViaBackgroundJob(format, reportType)
        toast.success(`${reportType.split("_").join(" ")} ${format.toUpperCase()} downloaded`)
        return
      }

      const token = await getToken()
      const url = await exportReport(format, {
        ...scopeParams,
        reportType,
        sync: "true",
      })
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        await downloadBlob(response, reportType, format)
        toast.success(`${reportType.split("_").join(" ")} ${format.toUpperCase()} downloaded`)
        return
      }

      const message = await readExportErrorMessage(response)
      if (response.status === 400 && isSyncExportCapError(message)) {
        await exportViaBackgroundJob(format, reportType)
        toast.success(`${reportType.split("_").join(" ")} ${format.toUpperCase()} downloaded`)
        return
      }

      throw new Error(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }

  if (!hasPermission("report:view")) {
    return <EmptyState title="Reports unavailable" description="You do not have permission to view reports." />
  }

  const canExport = hasPermission("report:export")
  const canImport = hasPermission("survey:create")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wider text-destructive uppercase">Reports & Analytics</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Report Builder</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Generate, save, and export survey, municipality, and surveyor reports. PDF, Excel and dashboard exports.
        </p>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wide uppercase">Report Scope</CardTitle>
          <CardDescription>Filter data before export</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportScopeFiltersPanel value={filters} onChange={onFiltersChange} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ScopeMetricCard
          label="Surveys (scope)"
          value={surveysCount}
          icon={FileText}
          iconTone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          isLoading={metricsLoading}
        />
        <ScopeMetricCard
          label="Approved"
          value={approvedCount}
          icon={FileBarChart}
          iconTone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          isLoading={metricsLoading}
        />
        <ScopeMetricCard
          label="Rejected"
          value={rejectedCount}
          icon={FileSpreadsheet}
          iconTone="bg-red-500/10 text-red-600 dark:text-red-400"
          isLoading={metricsLoading}
        />
        <ScopeMetricCard
          label="Municipalities"
          value={municipalityCount}
          icon={Building2}
          iconTone="bg-slate-500/10 text-slate-600 dark:text-slate-300"
          isLoading={metricsLoading && municipalityCount === null}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">Visual Report Builder</h2>
            <p className="text-sm text-muted-foreground">Configure and export reports</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ReportActionCard
              icon={FileText}
              title="Survey Report"
              description="Full mobile survey data for current filter scope."
            >
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5"
                disabled={!canExport || exporting !== null}
                onClick={() => void handleExport("xlsx", "survey_data")}
              >
                {exporting === "survey_data:xlsx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                )}
                Export Excel
              </Button>
              {canImport ? (
                <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
                  <Link href="/import">
                    <Upload className="h-4 w-4" aria-hidden />
                    Import Excel
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled className="gap-1.5">
                  <Upload className="h-4 w-4" aria-hidden />
                  Import Excel
                </Button>
              )}
            </ReportActionCard>

            <ReportActionCard
              icon={Building2}
              title="Municipality Summary"
              description="Per-ULB totals and approval rates."
            >
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5"
                disabled={!canExport}
                onClick={() => toast.info("PDF export coming soon")}
              >
                <FileBarChart className="h-4 w-4" aria-hidden />
                PDF Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5"
                disabled={!canExport || exporting !== null}
                onClick={() => void handleExport("xlsx", "ulb")}
              >
                {exporting === "ulb:xlsx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                )}
                Excel Export
              </Button>
            </ReportActionCard>

            <ReportActionCard
              icon={Users}
              title="Surveyor Performance"
              description="Per-surveyor productivity and approval %."
            >
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5"
                disabled={!canExport}
                onClick={() => toast.info("Surveyor PDF export coming soon")}
              >
                <FileBarChart className="h-4 w-4" aria-hidden />
                PDF Export
              </Button>
            </ReportActionCard>

            <ReportActionCard
              icon={LayoutTemplate}
              title="QC Final Report"
              description="Ward-wise register of QC-approved properties with printable final reports."
            >
              <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
                <Link href="/qc/registry">Open Ward Register</Link>
              </Button>
            </ReportActionCard>

            <ReportActionCard
              icon={ScrollText}
              title="Demand Notice Panel"
              description="Filtered demand register with printable property notices."
            >
              <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" disabled title="Coming soon">
                Open Panel
              </Button>
            </ReportActionCard>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">Saved Reports</h2>
            <p className="text-sm text-muted-foreground">Quick access to recent exports</p>
          </div>
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="pt-4">
              <ul className="space-y-2">
                {SAVED_REPORTS.map((report) => (
                  <li
                    key={report.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors duration-200 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{report.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {report.type} · {report.updated}
                      </p>
                    </div>
                    <Save className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4 w-full cursor-pointer gap-1.5" disabled>
                <Download className="h-4 w-4" aria-hidden />
                Dashboard Export (coming soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
