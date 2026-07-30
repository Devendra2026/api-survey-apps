"use client"

import { WardCardActions } from "@/components/shared/ward-card-actions"
import type { CommandCenterWard } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { CheckCircle2, FileEdit, FolderOpen, Home, Send, Users } from "lucide-react"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

function completedValue(ward: CommandCenterWard) {
  return ward.completed ?? ward.qcApproved
}

export function CommandCenterWardGrid({
  wards,
  isLoading,
  hasUlbSelected,
  ulbId,
}: {
  wards: CommandCenterWard[]
  isLoading?: boolean
  hasUlbSelected: boolean
  ulbId?: string
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Ward-Wise Survey Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Total properties, drafts, submitted surveys, and completed/approved metrics per ward.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border-slate-100 shadow-sm dark:border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasUlbSelected || wards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-card px-6 py-16 text-center dark:border-slate-800">
          <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-violet-500/10" />
            <FolderOpen className="relative size-7" />
          </span>
          <p className="text-base font-semibold text-foreground">No ward data</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasUlbSelected
              ? "No active wards in master data for this municipality (or none in your scope)."
              : "Select a municipality or adjust smart filters to see ward-wise survey cards."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wards.map((ward) => (
            <Card
              key={ward.wardId}
              className={cn(
                "border-slate-100 shadow-sm transition-all duration-300",
                "hover:-translate-y-1 hover:shadow-md dark:border-slate-800"
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <CardTitle className="truncate text-sm font-semibold">{ward.wardName}</CardTitle>
                <Badge
                  variant="secondary"
                  className="shrink-0 rounded-full bg-violet-500/10 font-medium text-violet-700 dark:text-violet-300"
                >
                  <Users className="size-3" />
                  {formatNum(ward.activeSurveyors)} surveyor
                  {ward.activeSurveyors === 1 ? "" : "s"}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-2.5 pt-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Home className="size-3.5 text-violet-500" />
                    Total Properties
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{formatNum(ward.totalProperties)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <FileEdit className="size-3.5 text-amber-500" />
                    Draft
                  </span>
                  <Badge className="rounded-full bg-amber-500/10 font-medium text-amber-600 hover:bg-amber-500/10">
                    {formatNum(ward.draft)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Send className="size-3.5 text-indigo-500" />
                    Submitted
                  </span>
                  <Badge className="rounded-full bg-indigo-500/10 font-medium text-indigo-500 hover:bg-indigo-500/10">
                    {formatNum(ward.submitted)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Completed / Approved
                  </span>
                  <Badge className="rounded-full bg-emerald-500/10 font-medium text-emerald-500 hover:bg-emerald-500/10">
                    {formatNum(completedValue(ward))}
                  </Badge>
                </div>

                {ulbId ? (
                  <div className="pt-1">
                    <WardCardActions ids={{ wardId: ward.wardId, ulbId }} pendingCount={ward.submitted} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
