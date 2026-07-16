"use client"

import type { QcMetrics } from "@/lib/api/types"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Clock3, FileEdit, Percent } from "lucide-react"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

const cards: Array<{
  id: string
  label: string
  icon: LucideIcon
  iconTone: string
  value: (m: QcMetrics) => string
  subtext: (m: QcMetrics) => string
}> = [
  {
    id: "pendingQc",
    label: "PENDING QC",
    icon: Clock3,
    iconTone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    value: (m) => formatNum(m.pendingQc),
    subtext: (m) => `${formatNum(m.pendingQcRemaining)} remaining · ${formatNum(m.submittedTotal)} submitted total`,
  },
  {
    id: "approvedQc",
    label: "APPROVED QC",
    icon: CheckCircle2,
    iconTone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    value: (m) => formatNum(m.approvedQc),
    subtext: (m) => `${m.qcProgressPct}% QC complete`,
  },
  {
    id: "qcProgress",
    label: "QC PROGRESS",
    icon: Percent,
    iconTone: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    value: (m) => `${m.qcProgressPct}%`,
    subtext: (m) => `${formatNum(m.approvedQc)} approved of ${formatNum(m.queueTotal)} in queue`,
  },
  {
    id: "fieldDrafts",
    label: "FIELD DRAFTS",
    icon: FileEdit,
    iconTone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    value: (m) => formatNum(m.fieldDrafts),
    subtext: (m) => `${formatNum(m.draftsSubmittedToday)} submitted today`,
  },
]

export function QcMetricSummary({ metrics, isLoading }: { metrics?: QcMetrics; isLoading?: boolean }) {
  if (isLoading || !metrics) {
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
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.id}
            className={cn(
              "border-slate-100 bg-card/80 shadow-sm backdrop-blur transition-all duration-300",
              "hover:-translate-y-1 hover:shadow-md dark:border-slate-800"
            )}
          >
            <CardContent className="pt-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground">{card.label}</p>
                <span className={cn("flex size-9 items-center justify-center rounded-lg", card.iconTone)}>
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {card.value(metrics)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{card.subtext(metrics)}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
