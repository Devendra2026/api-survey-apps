"use client"

import { DemandNoticeDocumentView } from "@/components/demand-notice/demand-notice-document"
import { ReportScopeFiltersPanel, type ReportScopeState } from "@/components/reports/report-scope-filters"
import { useReferenceEntries } from "@/features/configuration/hooks/use-configuration"
import { apiGet, apiPost } from "@/lib/api/client"
import type { DemandNoticeDocument, DemandNoticeRegisterRow } from "@/lib/demand-notice/types"
import { formatInr } from "@/lib/demand-notice/types"
import {
  downloadFromUrl,
  enqueueReportExport,
  getExportJobDownload,
  waitForExportJob,
} from "@/lib/reports/export-download"
import { useAuthStore } from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ArrowLeft, Eye, FileDown, Loader2, Printer, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type ListResponse = {
  items: DemandNoticeRegisterRow[]
  meta: { total: number; page: number; limit: number; totalPages: number }
  kpis: { noticeCount: number; pageDemand: number; rateMissingCount: number }
}

export default function DemandNoticesPanelPage() {
  const hasExport = useAuthStore((s) => s.hasPermission("report:export"))
  const [scope, setScope] = useState<ReportScopeState>({})
  const [assessmentYearId, setAssessmentYearId] = useState<string>("")
  const [page, setPage] = useState(1)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const { data: years } = useReferenceEntries("ASSESSMENT_YEAR", { limit: 50 })
  const yearItems = years?.items ?? []

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("limit", "25")
    if (scope.districtId) params.set("districtId", scope.districtId)
    if (scope.ulbId) params.set("ulbId", scope.ulbId)
    if (scope.wardId) params.set("wardId", scope.wardId)
    if (assessmentYearId) params.set("assessmentYearId", assessmentYearId)
    return params.toString()
  }, [page, scope.districtId, scope.ulbId, scope.wardId, assessmentYearId])

  const listQuery = useQuery({
    queryKey: ["demand-notices", queryString],
    queryFn: () => apiGet<ListResponse>(`/demand-notices?${queryString}`),
  })

  const previewQuery = useQuery({
    queryKey: ["demand-notice", previewId],
    queryFn: () => apiGet<DemandNoticeDocument>(`/demand-notices/${previewId}`),
    enabled: Boolean(previewId),
  })

  async function handleWardPdf() {
    if (!scope.wardId) {
      toast.error("Select a ward to download the ward PDF bundle")
      return
    }
    setExporting(true)
    try {
      const params: Record<string, string> = {
        reportType: "demand_notices",
        wardId: scope.wardId,
        qcStatus: "APPROVED",
      }
      if (scope.districtId) params.districtId = scope.districtId
      if (scope.ulbId) params.ulbId = scope.ulbId
      if (assessmentYearId) params.assessmentYearId = assessmentYearId

      const { jobId } = await enqueueReportExport("pdf", params)
      toast.info("Generating ward demand notice PDF…")
      await waitForExportJob(jobId, { timeoutMs: 10 * 60_000 })
      const download = await getExportJobDownload(jobId)
      await downloadFromUrl(download.url, download.filename)
      toast.success("Ward PDF downloaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ward PDF failed")
    } finally {
      setExporting(false)
    }
  }

  async function printOne(surveyId: string) {
    try {
      const { token } = await apiPost<{ token: string }>("/demand-notices/print-token", { surveyId })
      window.open(`/print/demand-notices/${surveyId}?token=${encodeURIComponent(token)}`, "_blank")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open print view")
    }
  }

  const kpis = listQuery.data?.kpis
  const items = listQuery.data?.items ?? []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
            <Link href="/reports">
              <ArrowLeft className="size-4" aria-hidden />
              Reports
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Demand Notice Panel</h1>
            <p className="text-sm text-muted-foreground">QC-approved notices · A4 print · ward PDF bundle</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            className="cursor-pointer gap-1.5"
            disabled={!hasExport || !scope.wardId || exporting}
            onClick={() => void handleWardPdf()}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            Download ward PDF
          </Button>
        </div>
      </div>

      <div className="print-hidden space-y-4">
        <ReportScopeFiltersPanel
          value={scope}
          onChange={(next) => {
            setScope(next)
            setPage(1)
          }}
        />
        <div className="max-w-xs space-y-1.5">
          <Label>Assessment year</Label>
          <Select
            value={assessmentYearId || "__all__"}
            onValueChange={(v) => {
              setAssessmentYearId(v === "__all__" ? "" : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All years</SelectItem>
              {yearItems.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name || y.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="print-hidden grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Approved notices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{kpis?.noticeCount ?? "—"}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Page demand
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {kpis ? formatInr(kpis.pageDemand) : "—"}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Rate missing
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700 tabular-nums">
            {kpis?.rateMissingCount ?? "—"}
          </CardContent>
        </Card>
      </div>

      <Card className="print-hidden rounded-2xl">
        <CardContent className="pt-4">
          {listQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property ID</TableHead>
                  <TableHead>Ward</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Demand</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No QC-approved notices in this scope
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.surveyId}>
                      <TableCell className="font-medium">{row.propertyId}</TableCell>
                      <TableCell>{row.wardNumber}</TableCell>
                      <TableCell>{row.ownerName}</TableCell>
                      <TableCell>{row.assessmentYearLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.rateMissing ? (
                          <span className="text-amber-700" title={row.rateMissingReason ?? undefined}>
                            Rate missing
                          </span>
                        ) : row.totalDemand != null ? (
                          formatInr(row.totalDemand)
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer"
                            onClick={() => setPreviewId(row.surveyId)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="cursor-pointer" asChild>
                            <Link href={`/reports/demand-notices/${row.surveyId}`}>
                              <Printer className="size-4" />
                            </Link>
                          </Button>
                          {hasExport ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="cursor-pointer"
                              onClick={() => void printOne(row.surveyId)}
                              title="Open print view"
                            >
                              Print
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {listQuery.data?.meta.page ?? page} of {listQuery.data?.meta.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={page >= (listQuery.data?.meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {previewId ? (
        <div
          className="print-hidden fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Demand notice preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewId(null)
          }}
        >
          <div className="relative w-full max-w-[220mm] rounded-xl bg-slate-100 p-4 pt-12 shadow-xl sm:p-6 sm:pt-14">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-3 right-3 z-10 size-9 cursor-pointer rounded-full border-slate-300 bg-white shadow-sm hover:bg-slate-50"
              onClick={() => setPreviewId(null)}
              aria-label="Close preview"
            >
              <X className="size-4" aria-hidden />
            </Button>
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2 pr-10">
              <Button asChild size="sm" className="cursor-pointer gap-1.5">
                <Link href={`/reports/demand-notices/${previewId}`}>
                  <Printer className="size-4" aria-hidden />
                  Open full / Print
                </Link>
              </Button>
            </div>
            {previewQuery.isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : previewQuery.data ? (
              <DemandNoticeDocumentView doc={previewQuery.data} className="mx-auto shadow-sm" />
            ) : (
              <p className="text-sm text-red-600">Failed to load preview</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
