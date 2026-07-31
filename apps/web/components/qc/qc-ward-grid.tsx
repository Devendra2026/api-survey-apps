"use client"

import { WardCardActions } from "@/components/shared/ward-card-actions"
import type { QcWard } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { CheckCircle2, FileEdit, FolderOpen, Home, Send } from "lucide-react"
import type { ReactNode } from "react"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

function wardTitle(ward: QcWard) {
  if (ward.label) return ward.label
  const padded = String(ward.wardNumber).padStart(2, "0")
  const name = ward.wardName?.replace(/^Ward\s*/i, "").trim() || ward.wardName
  return `Ward No. ${padded} — ${name}`
}

export function QcWardGrid({
  wards,
  isLoading,
  hasUlbSelected,
  ulbId,
}: {
  wards: QcWard[]
  isLoading?: boolean
  hasUlbSelected: boolean
  ulbId?: string
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wider text-foreground uppercase">Ward Wise QC Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Field drafts, QC pending, approved, and total properties per ward.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-100 shadow-sm dark:border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasUlbSelected || wards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-card/80 px-6 py-16 text-center backdrop-blur dark:border-slate-800">
          <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-teal-500/10" />
            <FolderOpen className="relative size-7" />
          </span>
          <p className="text-base font-semibold text-foreground">No ward QC data</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasUlbSelected
              ? "No wards match the current filters. Adjust district, ULB, or ward selection."
              : "Select a municipality in Filter Control Panel to see ward-wise QC review cards."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wards.map((ward) => (
            <Card
              key={ward.wardId}
              className={cn(
                "border-slate-100 bg-card/80 shadow-sm backdrop-blur transition-all duration-300",
                "hover:-translate-y-1 hover:shadow-md dark:border-slate-800"
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <CardTitle className="truncate text-sm font-semibold">{wardTitle(ward)}</CardTitle>
                <Badge className="shrink-0 rounded-full bg-rose-500/15 font-medium text-rose-700 hover:bg-rose-500/15 dark:text-rose-300">
                  {formatNum(ward.pending)} pending
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <MetricCell
                    icon={<FileEdit className="size-3.5 text-amber-500" />}
                    label="FIELD DRAFTS"
                    value={ward.fieldDrafts}
                    tone="bg-amber-500/5"
                  />
                  <MetricCell
                    icon={<Send className="size-3.5 text-indigo-500" />}
                    label="QC PENDING"
                    value={ward.qcPending}
                    tone="bg-indigo-500/5"
                  />
                  <MetricCell
                    icon={<CheckCircle2 className="size-3.5 text-emerald-500" />}
                    label="QC APPROVED"
                    value={ward.qcApproved}
                    tone="bg-emerald-500/5"
                  />
                  <MetricCell
                    icon={<Home className="size-3.5 text-violet-500" />}
                    label="TOTAL PROPERTY"
                    value={ward.totalProperty}
                    tone="bg-violet-500/5"
                  />
                </div>

                {ulbId ? <WardCardActions ids={{ wardId: ward.wardId, ulbId }} pendingCount={ward.pending} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function MetricCell({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-lg border border-slate-100 px-2.5 py-2 dark:border-slate-800", tone)}>
      <div className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-base font-bold text-foreground tabular-nums">{formatNum(value)}</p>
    </div>
  )
}
