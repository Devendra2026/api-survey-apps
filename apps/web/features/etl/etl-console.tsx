"use client"

import { EmptyState, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import {
  useAlignWardsWithConvex,
  useCleanupEmptyDuplicateStates,
  useDedupeWards,
  useEtlJobs,
  useEtlReport,
  useEtlStatus,
  useRetryEtlFailed,
  useStartEtlFull,
  useStartEtlIncremental,
  useStartEtlRefreshPending,
  useStartEtlValidate,
  useSyncWardsFromConvex,
} from "@/features/etl/hooks/use-etl-status"
import type {
  AlignWardsPipelineResult,
  EmptyStateCleanupResult,
  WardDedupeResult,
  WardSyncResult,
} from "@/features/etl/lib/etl-api"
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
import { GitMerge, MapPin, RefreshCw, RotateCcw, ShieldCheck, Trash2, Upload } from "lucide-react"
import { useState, type ReactNode } from "react"
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

function AlignResultPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {children}
    </div>
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
  const startRefreshPending = useStartEtlRefreshPending()
  const dedupeWards = useDedupeWards()
  const syncWards = useSyncWardsFromConvex()
  const cleanupStates = useCleanupEmptyDuplicateStates()
  const alignPipeline = useAlignWardsWithConvex()
  const [fullConfirmOpen, setFullConfirmOpen] = useState(false)
  const [alignApplyConfirm, setAlignApplyConfirm] = useState<"dedupe" | "sync" | "cleanup" | "pipeline" | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [dedupeResult, setDedupeResult] = useState<WardDedupeResult | null>(null)
  const [syncResult, setSyncResult] = useState<WardSyncResult | null>(null)
  const [cleanupResult, setCleanupResult] = useState<EmptyStateCleanupResult | null>(null)
  const [pipelineResult, setPipelineResult] = useState<AlignWardsPipelineResult | null>(null)
  const { data: report } = useEtlReport(selectedJobId)

  const alignBusy = dedupeWards.isPending || syncWards.isPending || cleanupStates.isPending || alignPipeline.isPending
  const busy =
    isEtlJobActive(status?.activeJob?.status) ||
    startIncremental.isPending ||
    startFull.isPending ||
    retryFailed.isPending ||
    startValidate.isPending ||
    startRefreshPending.isPending ||
    alignBusy

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

  const runRefreshPending = async () => {
    try {
      const result = await startRefreshPending.mutateAsync(undefined)
      toast.success(`Refresh pending queued (${result.jobId.slice(0, 8)}…)`)
      await Promise.all([refetchStatus(), refetchJobs()])
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runDedupe = async (apply: boolean) => {
    try {
      const result = await dedupeWards.mutateAsync({ apply })
      setDedupeResult(result)
      setAlignApplyConfirm(null)
      toast.success(
        apply
          ? `Dedupe applied: ${result.wardsSoftDeleted} wards soft-deleted, ${result.surveysRemapped} surveys remapped`
          : `Dry-run: ${result.duplicateGroups} duplicate groups across ${result.ulbs} ULBs`
      )
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runSyncWards = async (apply: boolean) => {
    try {
      const result = await syncWards.mutateAsync(apply)
      setSyncResult(result)
      setAlignApplyConfirm(null)
      toast.success(
        apply
          ? `Ward sync applied: +${result.created} created, ${result.updated} updated, ${result.merged} merged`
          : `Dry-run: would create ${result.created}, update ${result.updated}, merge ${result.merged} (catalog ${result.catalogSize})`
      )
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runCleanupStates = async (apply: boolean) => {
    try {
      const result = await cleanupStates.mutateAsync(apply)
      setCleanupResult(result)
      setAlignApplyConfirm(null)
      toast.success(
        apply
          ? `Deleted ${result.deleted.length} empty state shell(s)`
          : `Dry-run: ${result.deleted.length} empty shell(s) would be deleted`
      )
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const runAlignPipeline = async (apply: boolean) => {
    try {
      const result = await alignPipeline.mutateAsync(apply)
      setPipelineResult(result)
      setAlignApplyConfirm(null)
      if (apply) {
        toast.success(
          result.ok ? "Wards aligned — Nest matches Convex catalog" : "Align finished with mismatches — check report"
        )
      } else {
        toast.success(
          result.ok
            ? "Dry-run: already matched (safe to apply)"
            : `Dry-run: ${result.steps.verify.mismatchedUlbs.length} ULB mismatch(es) — review then confirm apply`
        )
        if (!result.ok || result.steps.dedupe.duplicateGroups > 0 || result.steps.sync.created > 0) {
          setAlignApplyConfirm("pipeline")
        }
      }
      if (!result.ok && result.steps.sync.conflicts[0]) {
        toast.message(result.steps.sync.conflicts[0]!.slice(0, 180))
      }
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
            Refresh Pending updates Nest drafts that Convex already submitted (never overwrites Admin QC).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" className="cursor-pointer" disabled={busy} onClick={() => void runIncremental()}>
            <RefreshCw className="size-4" aria-hidden />
            Start Incremental
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => void runRefreshPending()}
          >
            <GitMerge className="size-4" aria-hidden />
            Refresh Pending
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
          <CardTitle className="text-base">Align geography</CardTitle>
          <CardDescription>
            Match Nest wards to the Convex catalog. Primary path runs dedupe → sync → cleanup empty UP shells → verify
            in one go. Keep UP code <strong>09</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => void runAlignPipeline(false)}
            >
              <MapPin className="size-4" aria-hidden />
              Align Wards with Convex
            </Button>
          </div>

          {pipelineResult ? (
            <AlignResultPanel
              title={`Align pipeline · ${pipelineResult.mode} · ${pipelineResult.ok ? "OK" : "needs attention"}`}
              onClose={() => setPipelineResult(null)}
            >
              <p className="text-muted-foreground">
                Dedupe: {pipelineResult.steps.dedupe.duplicateGroups} groups · Sync: +
                {pipelineResult.steps.sync.created} / ~{pipelineResult.steps.sync.updated} / merge{" "}
                {pipelineResult.steps.sync.merged} · Cleanup: {pipelineResult.steps.cleanup.deleted.length} shell(s) ·
                Matched ULBs: {pipelineResult.steps.verify.matchedUlbCount} · Catalog:{" "}
                {pipelineResult.steps.verify.catalogSize}
              </p>
              {pipelineResult.steps.sync.conflicts.length > 0 ? (
                <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-amber-700 dark:text-amber-400">
                  {pipelineResult.steps.sync.conflicts.slice(0, 15).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {pipelineResult.steps.sync.missingUlbs.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Missing Nest ULBs: {pipelineResult.steps.sync.missingUlbs.join(", ")}
                </p>
              ) : null}
              {pipelineResult.steps.verify.mismatchedUlbs.length > 0 ? (
                <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground">
                  {pipelineResult.steps.verify.mismatchedUlbs.slice(0, 30).map((m) => (
                    <li key={m.ulb}>
                      {m.ulb}: Nest {m.nest} vs Convex {m.convex}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Ward counts match Convex per ULB.</p>
              )}
            </AlignResultPanel>
          ) : null}

          <details className="rounded-lg border border-border/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">Advanced (single steps)</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runDedupe(false)}
              >
                Dedupe (dry-run)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => setAlignApplyConfirm("dedupe")}
              >
                Dedupe (apply)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runSyncWards(false)}
              >
                Sync (dry-run)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => setAlignApplyConfirm("sync")}
              >
                Sync (apply)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => void runCleanupStates(false)}
              >
                <Trash2 className="size-4" aria-hidden />
                Cleanup UP (dry-run)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={() => setAlignApplyConfirm("cleanup")}
              >
                Cleanup UP (apply)
              </Button>
            </div>
          </details>

          {dedupeResult ? (
            <AlignResultPanel title={`Dedupe · ${dedupeResult.mode}`} onClose={() => setDedupeResult(null)}>
              <p className="text-muted-foreground">
                ULBs: {dedupeResult.ulbs} · duplicate groups: {dedupeResult.duplicateGroups} · surveys remapped:{" "}
                {dedupeResult.surveysRemapped} · wards soft-deleted: {dedupeResult.wardsSoftDeleted}
              </p>
              {dedupeResult.samples.length > 0 ? (
                <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground">
                  {dedupeResult.samples.map((s) => (
                    <li key={`${s.ulb}-${s.norm}`}>
                      {s.ulb} · {s.norm} → keep {s.primary.wardNumber} ({s.primary.surveys} surveys); drop{" "}
                      {s.dupes.map((d) => d.wardNumber).join(", ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </AlignResultPanel>
          ) : null}

          {syncResult ? (
            <AlignResultPanel title={`Ward sync · ${syncResult.mode}`} onClose={() => setSyncResult(null)}>
              <p className="text-muted-foreground">
                Catalog: {syncResult.catalogSize} · created: {syncResult.created} · updated: {syncResult.updated} ·
                merged: {syncResult.merged} · skipped: {syncResult.skipped}
              </p>
              {syncResult.conflicts.length > 0 ? (
                <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-amber-700 dark:text-amber-400">
                  {syncResult.conflicts.slice(0, 20).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {syncResult.missingUlbs.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Missing Nest ULBs: {syncResult.missingUlbs.join(", ")}
                </p>
              ) : null}
              {syncResult.wardCountMismatches.length > 0 ? (
                <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground">
                  {syncResult.wardCountMismatches.slice(0, 30).map((m) => (
                    <li key={m.ulb}>
                      {m.ulb}: Nest {m.nest} vs Convex {m.convex}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Ward counts match Convex catalog per ULB.</p>
              )}
            </AlignResultPanel>
          ) : null}

          {cleanupResult ? (
            <AlignResultPanel title={`Empty UP cleanup · ${cleanupResult.mode}`} onClose={() => setCleanupResult(null)}>
              {cleanupResult.deleted.length > 0 ? (
                <p className="text-muted-foreground">
                  {cleanupResult.mode === "apply" ? "Deleted" : "Would delete"}:{" "}
                  {cleanupResult.deleted.map((d) => `${d.name} (${d.code})`).join(", ")}
                </p>
              ) : (
                <p className="text-muted-foreground">No empty shells to remove.</p>
              )}
              {cleanupResult.skipped.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {cleanupResult.skipped.map((s) => (
                    <li key={s.id}>
                      Skipped {s.name} ({s.code}): {s.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </AlignResultPanel>
          ) : null}
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

      <Dialog open={alignApplyConfirm !== null} onOpenChange={(open) => !open && setAlignApplyConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alignApplyConfirm === "pipeline"
                ? "Apply Align Wards with Convex?"
                : alignApplyConfirm === "dedupe"
                  ? "Apply ward dedupe?"
                  : alignApplyConfirm === "sync"
                    ? "Apply ward sync from Convex?"
                    : "Delete empty UP state shells?"}
            </DialogTitle>
            <DialogDescription>
              {alignApplyConfirm === "pipeline"
                ? "Runs dedupe → sync from Convex → cleanup empty UP shells (01 / UP / UP-01). Keeps UP 09. Review the dry-run report above first."
                : alignApplyConfirm === "dedupe"
                  ? "Remaps surveys onto the primary ward and soft-deletes duplicates. Run dry-run first if you have not."
                  : alignApplyConfirm === "sync"
                    ? "Creates/updates Nest wards from the Convex ward catalog. Prefer after dedupe."
                    : "Deletes empty states coded 01 / UP / UP-01 only when they have no districts or surveys. Keeps UP 09."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAlignApplyConfirm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={alignApplyConfirm === "cleanup" ? "destructive" : "default"}
              className="cursor-pointer"
              disabled={alignBusy}
              onClick={() => {
                if (alignApplyConfirm === "pipeline") void runAlignPipeline(true)
                else if (alignApplyConfirm === "dedupe") void runDedupe(true)
                else if (alignApplyConfirm === "sync") void runSyncWards(true)
                else if (alignApplyConfirm === "cleanup") void runCleanupStates(true)
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
