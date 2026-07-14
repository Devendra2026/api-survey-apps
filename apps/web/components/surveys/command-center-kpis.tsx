"use client"

import type { CommandCenterKpis } from "@/lib/api/types"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, FileEdit, Home, Send } from "lucide-react"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

function approvedValue(k: CommandCenterKpis) {
  return k.approvedCompleted ?? k.qcApproved
}

const metrics: Array<{
  id: string
  label: string
  icon: LucideIcon
  iconTone: string
  value: (k: CommandCenterKpis) => number
  subtext: (k: CommandCenterKpis) => string
}> = [
  {
    id: "totalProperties",
    label: "Total Properties",
    icon: Home,
    iconTone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    value: (k) => k.totalProperties,
    subtext: (k) => `${k.avgFieldCompletionPct}% avg field completion`,
  },
  {
    id: "draftSurveys",
    label: "Draft Surveys",
    icon: FileEdit,
    iconTone: "bg-amber-500/10 text-amber-500",
    value: (k) => k.draftSurveys,
    subtext: (k) => `${formatNum(k.editedToday ?? 0)} edited today`,
  },
  {
    id: "submittedSurveys",
    label: "Submitted Surveys",
    icon: Send,
    iconTone: "bg-indigo-500/10 text-indigo-500",
    value: (k) => k.submittedSurveys,
    subtext: (k) => `${formatNum(k.awaitingQc)} awaiting verification`,
  },
  {
    id: "approvedCompleted",
    label: "Approved / Completed",
    icon: CheckCircle2,
    iconTone: "bg-emerald-500/10 text-emerald-500",
    value: approvedValue,
    subtext: () => "Sync complete",
  },
]

export function CommandCenterKpiRow({ kpis, isLoading }: { kpis?: CommandCenterKpis; isLoading?: boolean }) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-slate-100 shadow-sm dark:border-slate-800">
            <CardContent className="space-y-3 pt-1">
              <div className="flex items-start justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="size-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon
        return (
          <Card
            key={m.id}
            className={cn(
              "border-slate-100 shadow-sm transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-md dark:border-slate-800"
            )}
          >
            <CardContent className="pt-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                <span className={cn("flex size-9 items-center justify-center rounded-lg", m.iconTone)}>
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {formatNum(m.value(kpis))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{m.subtext(kpis)}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
