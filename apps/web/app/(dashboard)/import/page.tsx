"use client"

import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useImportJob, useImportJobs, useImportSurveys } from "@/hooks/use-api"
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api/client"
import type { ImportJob, ImportRowError } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { cn } from "@workspace/ui/lib/utils"
import { FileSpreadsheet, RefreshCw, RotateCcw, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

function formatImportErrors(errors: ImportRowError[] | undefined): string[] {
  if (!errors?.length) return []
  return errors.slice(0, 40).map((err) => {
    const where = err.propertyId ? `Property ${err.propertyId}` : err.localId ? `Local ${err.localId}` : "Row"
    const messages = err.errors?.length ? err.errors.join("; ") : "Invalid survey row"
    return `Row ${err.row} · ${where}: ${messages}`
  })
}

function jobResultMessage(job: ImportJob): string {
  if (job.status === "FAILED") {
    return job.errorMessage?.trim() || "Import failed"
  }
  if (job.status === "SUCCEEDED") {
    const imported = job.successCount ?? 0
    const failed = job.failureCount ?? 0
    if (failed > 0) {
      return `Imported ${imported} surveys · ${failed} failed`
    }
    return `Imported ${imported} surveys`
  }
  if (job.status === "PROCESSING") {
    return `Processing ${job.processedRows ?? 0} / ${job.totalRows || "…"} rows`
  }
  return "Import queued — processing in the background"
}

function progressPercent(job: ImportJob): number {
  if (!job.totalRows) return job.status === "SUCCEEDED" ? 100 : 5
  return Math.min(100, Math.round((job.processedRows / job.totalRows) * 100))
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)
  const toastedJobId = useRef<string | null>(null)

  const importMutation = useImportSurveys()
  const { data: jobs, refetch } = useImportJobs()
  const { data: watchedJob } = useImportJob(selectedJobId)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }, [])

  useEffect(() => {
    if (!watchedJob || pendingJobId !== watchedJob.id) return
    if (toastedJobId.current === watchedJob.id) return

    if (watchedJob.status === "SUCCEEDED") {
      toastedJobId.current = watchedJob.id
      toast.success(jobResultMessage(watchedJob))
      // Sync local UI with completed import job from the API watcher.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing pending state after external job settles
      setPendingJobId(null)
      setFile(null)
    } else if (watchedJob.status === "FAILED") {
      toastedJobId.current = watchedJob.id
      toast.error(jobResultMessage(watchedJob))
      setPendingJobId(null)
    }
  }, [watchedJob, pendingJobId])

  const displayJob =
    (selectedJobId && watchedJob?.id === selectedJobId ? watchedJob : null) ??
    (selectedJobId ? jobs?.find((j) => j.id === selectedJobId) : null) ??
    jobs?.[0] ??
    null

  const errorLines = useMemo(() => formatImportErrors(displayJob?.resultSummary?.errors), [displayJob])
  const percent = displayJob ? progressPercent(displayJob) : 0

  async function handleImport() {
    if (!file) {
      toast.error("Select a file first")
      return
    }

    try {
      const result = await importMutation.mutateAsync(file)
      toastedJobId.current = null
      setPendingJobId(result.jobId)
      setSelectedJobId(result.jobId)
      toast.message("Import queued — surveys will appear when processing finishes")
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  async function handleResume(jobId: string) {
    setResuming(true)
    try {
      await apiPost(`/imports/jobs/${jobId}/resume`)
      toast.message("Import resumed from checkpoint")
      setPendingJobId(jobId)
      setSelectedJobId(jobId)
      await refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setResuming(false)
    }
  }

  async function handleRetryFailed(jobId: string) {
    setResuming(true)
    try {
      await apiPost(`/imports/jobs/${jobId}/retry-failed`)
      toast.message("Failed rows queued for retry")
      setPendingJobId(jobId)
      setSelectedJobId(jobId)
      await refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setResuming(false)
    }
  }

  const isBusy = importMutation.isPending || Boolean(pendingJobId)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Excel import"
        description="Streaming-ready Convex workbook imports with validation reports, checkpoints, and image migration"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="shadow-none lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Upload workbook</CardTitle>
            <CardDescription>
              Accepts Surveys / CoOwners / Floors / Photos / Guide sheets (.xlsx) or CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
                dragging ? "border-primary bg-accent/40" : "hover:bg-muted/40"
              )}
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{file ? file.name : "Drop a file here or click to browse"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Designed for 100k+ survey rows via background queue</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Button onClick={() => void handleImport()} disabled={!file || isBusy} size="sm">
              <Upload className="size-3.5" />
              {isBusy ? "Importing…" : "Start import"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Import contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Match key: Property ID, then Local ID</p>
            <p>• Duplicate detection across workbook + database</p>
            <p>• Per-survey transactions with checkpoint resume</p>
            <p>• Broken images never stop the survey import</p>
            <p>• Validation report stored on the job for download</p>
          </CardContent>
        </Card>
      </div>

      {displayJob ? (
        <div className="space-y-3">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-medium">{displayJob.originalName}</CardTitle>
                <CardDescription className="mt-1">{jobResultMessage(displayJob)}</CardDescription>
              </div>
              <StatusBadge status={displayJob.status} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-mono tabular-nums">{percent}%</span>
                </div>
                <Progress value={percent} />
                {displayJob.totalRows > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {displayJob.processedRows} / {displayJob.totalRows} rows processed
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Imported" value={displayJob.successCount ?? 0} />
                <KpiCard title="Failed rows" value={displayJob.failureCount ?? 0} />
                <KpiCard title="Photos OK" value={displayJob.photoSuccessCount ?? 0} />
                <KpiCard title="Photos failed" value={displayJob.photoFailureCount ?? 0} />
              </div>

              {displayJob.errorMessage ? <p className="text-sm text-destructive">{displayJob.errorMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                {(displayJob.status === "FAILED" || displayJob.status === "CANCELLED") &&
                displayJob.errorReportKey !== undefined ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resuming}
                    onClick={() => void handleResume(displayJob.id)}
                  >
                    <RotateCcw className="size-3.5" />
                    Resume checkpoint
                  </Button>
                ) : null}
                {(displayJob.failureCount ?? 0) > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resuming}
                    onClick={() => void handleRetryFailed(displayJob.id)}
                  >
                    <RefreshCw className="size-3.5" />
                    Retry failed rows
                  </Button>
                ) : null}
                {displayJob.errorReportKey ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void (async () => {
                        try {
                          const report = await apiGet<{ url: string }>(`/imports/jobs/${displayJob.id}/error-report`)
                          window.open(report.url, "_blank", "noopener,noreferrer")
                        } catch (error) {
                          toast.error(getApiErrorMessage(error))
                        }
                      })()
                    }}
                  >
                    Open validation report
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {errorLines.length ? (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Validation report preview</CardTitle>
                <CardDescription>Showing first {errorLines.length} row errors from resultSummary</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                  {errorLines.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {jobs && jobs.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Import history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.slice(0, 12).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.originalName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {job.successCount ?? 0} imported · {job.failureCount ?? 0} failed · photos{" "}
                    {job.photoSuccessCount ?? 0}/{(job.photoSuccessCount ?? 0) + (job.photoFailureCount ?? 0)}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
