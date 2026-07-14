"use client"

import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useImportJob, useImportJobs, useImportSurveys } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { ImportJob, ImportRowError } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { FileSpreadsheet, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

function formatImportErrors(errors: ImportRowError[] | undefined): string[] {
  if (!errors?.length) return []
  return errors.slice(0, 20).map((err) => {
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

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const toastedJobId = useRef<string | null>(null)

  const importMutation = useImportSurveys()
  const { data: jobs } = useImportJobs()
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

  const isBusy = importMutation.isPending || Boolean(pendingJobId)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Import surveys" description="Bulk import property surveys from Excel (.xlsx) or CSV files" />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Upload file</CardTitle>
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
            <p className="mt-1 text-xs text-muted-foreground">Accepts .xlsx, .xls, or .csv</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={() => void handleImport()} disabled={!file || isBusy} size="sm">
            <Upload className="size-3.5" />
            {isBusy ? "Importing…" : "Import surveys"}
          </Button>
        </CardContent>
      </Card>

      {displayJob ? (
        <div className="space-y-3">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="truncate text-sm font-medium">{displayJob.originalName}</CardTitle>
              <StatusBadge status={displayJob.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{jobResultMessage(displayJob)}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard title="Imported" value={displayJob.successCount ?? 0} />
                <KpiCard title="Failed" value={displayJob.failureCount ?? 0} />
              </div>
              {displayJob.totalRows > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {displayJob.processedRows} / {displayJob.totalRows} rows processed
                </p>
              ) : null}
              {displayJob.errorMessage ? <p className="text-sm text-destructive">{displayJob.errorMessage}</p> : null}
            </CardContent>
          </Card>

          {errorLines.length ? (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Row errors</CardTitle>
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
            <CardTitle className="text-sm font-medium">Recent imports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobs.slice(0, 8).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.originalName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {job.successCount ?? 0} imported · {job.failureCount ?? 0} failed
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
