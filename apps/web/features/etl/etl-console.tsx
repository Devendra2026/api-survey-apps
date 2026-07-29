"use client"

import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import {
  useEtlJobs,
  useEtlReport,
  useEtlStatus,
  useRetryEtlFailed,
  useStartEtlFull,
  useStartEtlIncremental,
  useStartEtlValidate,
} from "@/features/etl/hooks/use-etl-status"
import { isEtlJobActive, type EtlMigrationJob } from "@/features/etl/lib/types"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { RefreshCw, RotateCcw, ShieldCheck, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

function formatWhen(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function statsSummary(stats: unknown): string {
  if (!stats || typeof stats !== "object") return "—"
  const record = stats as Record<string, unknown>
  const parts: string[] = []
  for (const key of ["imported", "skipped", "failed", "imagesUploaded", "validated"] as const) {
    const v = record[key]
    if (typeof v === "number") parts.push(`${key}: ${v}`)
  }
  return parts.length ? parts.join(" · ") : JSON.stringify(stats).slice(0, 120)
}

function statsError(stats: unknown): string | null {
  if (!stats || typeof stats !== "object") return null
  const value = (stats as Record<string, unknown>).error
  return typeof value === "string" && value.trim() ? value : null
}

function ActiveStatusCard({
  etlEnabled,
  activeJob,
  migrationState,
}: {
  etlEnabled: boolean
  activeJob: EtlMigrationJob | null
  migrationState: { completed: number; failed: number; pending: number }
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pipeline status</CardTitle>
        <CardDescription>Convex → Nest worker → Postgres / MinIO</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={etlEnabled ? "default" : "secondary"}>Cron {etlEnabled ? "enabled" : "disabled"}</Badge>
          {activeJob ? (
            <>
              <Badge variant="outline">{activeJob.type}</Badge>
              <StatusBadge status={activeJob.status} />
            </>
          ) : (
            <Badge variant="secondary">No active job</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Completed: {migrationState.completed}</span>
          <span>·</span>
          <span>Failed: {migrationState.failed}</span>
          <span>·</span>
          <span>Pending: {migrationState.pending}</span>
        </div>
        {activeJob ? (
          <p className="text-xs text-muted-foreground">
            Job {activeJob.id} · started {formatWhen(activeJob.startedAt ?? activeJob.createdAt)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EtlConsole() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("etl:manage")
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useEtlStatus(canManage)
  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useEtlJobs(canManage)
  const startIncremental = useStartEtlIncremental()
  const startFull = useStartEtlFull()
  const retryFailed = useRetryEtlFailed()
  const startValidate = useStartEtlValidate()
  const [fullConfirmOpen, setFullConfirmOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const { data: report } = useEtlReport(selectedJobId)

  const busy =
    isEtlJobActive(status?.activeJob?.status) ||
    startIncremental.isPending ||
    startFull.isPending ||
    retryFailed.isPending ||
    startValidate.isPending

  if (!canManage) {
    return <EmptyState title="ETL Sync unavailable" description="Requires etl:manage permission." />
  }

  const runIncremental = async () => {
    try {
      const result = await startIncremental.mutateAsync(undefined)
      toast.success(`Incremental sync queued (${result.jobId.slice(0, 8)}…)`)
      await Promise.all([refetchStatus(), refetchJobs()])
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runFull = async () => {
    try {
      const result = await startFull.mutateAsync({})
      toast.success(`Full migration queued (${result.jobId.slice(0, 8)}…)`)
      setFullConfirmOpen(false)
      await Promise.all([refetchStatus(), refetchJobs()])
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runRetry = async () => {
    try {
      const result = await retryFailed.mutateAsync(undefined)
      toast.success(`Retry queued (${result.jobId.slice(0, 8)}…)`)
      await Promise.all([refetchStatus(), refetchJobs()])
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runValidate = async () => {
    try {
      const result = await startValidate.mutateAsync()
      toast.success(`Validation queued (${result.jobId.slice(0, 8)}…)`)
      await Promise.all([refetchStatus(), refetchJobs()])
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ETL Sync"
        description="Pull submitted surveys from self-hosted Convex into Postgres and store photos in MinIO."
        breadcrumbs={[{ label: "Administration", href: "/admin/users" }, { label: "ETL Sync" }]}
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => void Promise.all([refetchStatus(), refetchJobs()])}
          >
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {statusLoading && !status ? (
        <p className="text-sm text-muted-foreground">Loading status…</p>
      ) : status ? (
        <ActiveStatusCard
          etlEnabled={status.etlEnabled}
          activeJob={status.activeJob}
          migrationState={status.migrationState}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>
            Incremental is the safe default. Full migration re-walks all submitted surveys (dedupe via migration_state).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" className="cursor-pointer" disabled={busy} onClick={() => void runIncremental()}>
            <RefreshCw className="size-4" aria-hidden />
            Start Incremental
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => setFullConfirmOpen(true)}
          >
            <Upload className="size-4" aria-hidden />
            Start Full Migration
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => void runRetry()}
          >
            <RotateCcw className="size-4" aria-hidden />
            Retry Failed
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => void runValidate()}
          >
            <ShieldCheck className="size-4" aria-hidden />
            Validate Counts
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent jobs</CardTitle>
          <CardDescription>Latest migration jobs from Nest control plane.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading && !jobsData ? (
            <p className="text-sm text-muted-foreground">Loading jobs…</p>
          ) : !jobsData?.items.length ? (
            <p className="text-sm text-muted-foreground">No ETL jobs yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-160 text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Finished</th>
                    <th className="px-3 py-2 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {jobsData.items.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{job.type}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatWhen(job.createdAt)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatWhen(job.finishedAt)}</td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedJobId && report ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">
                  Report · {report.type} · <StatusBadge status={report.status} />
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedJobId(null)}>
                  Close
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Job {report.jobId}</p>
              <p className="mt-2 text-muted-foreground">{statsSummary(report.stats)}</p>
              {statsError(report.stats) ? (
                <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs wrap-break-word text-destructive">
                  {statsError(report.stats)}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={fullConfirmOpen} onOpenChange={setFullConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start full Convex migration?</DialogTitle>
            <DialogDescription>
              This walks all submitted surveys from Convex. Already-imported surveys are skipped via migration_state.
              Prefer Incremental for routine production syncs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setFullConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={startFull.isPending}
              onClick={() => void runFull()}
            >
              Start Full Migration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
