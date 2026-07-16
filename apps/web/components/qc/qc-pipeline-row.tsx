"use client"

import type { QcMetrics, QcPipelineStage } from "@/lib/api/types"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Clock3, Eye, RotateCcw } from "lucide-react"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

const stages: Array<{
  id: QcPipelineStage
  label: string
  icon: LucideIcon
  tone: string
  activeTone: string
  value: (m: QcMetrics) => number
}> = [
  {
    id: "pending",
    label: "PENDING",
    icon: Clock3,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    activeTone: "border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/40",
    value: (m) => m.pipeline.pending,
  },
  {
    id: "inReview",
    label: "IN REVIEW",
    icon: Eye,
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    activeTone: "border-blue-400/60 bg-blue-500/10 ring-1 ring-blue-400/40",
    value: (m) => m.pipeline.inReview,
  },
  {
    id: "approved",
    label: "APPROVED",
    icon: CheckCircle2,
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    activeTone: "border-emerald-400/60 bg-emerald-500/10 ring-1 ring-emerald-400/40",
    value: (m) => m.pipeline.approved,
  },
  {
    id: "returned",
    label: "RETURNED",
    icon: RotateCcw,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    activeTone: "border-rose-400/60 bg-rose-500/10 ring-1 ring-rose-400/40",
    value: (m) => m.pipeline.returned,
  },
]

export function QcPipelineRow({
  metrics,
  isLoading,
  activeStage,
  onStageChange,
}: {
  metrics?: QcMetrics
  isLoading?: boolean
  activeStage: QcPipelineStage | null
  onStageChange: (stage: QcPipelineStage | null) => void
}) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        QC Workflow Pipeline — Click a stage to filter the review queue.
      </p>

      {isLoading || !metrics ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-slate-100 shadow-sm dark:border-slate-800">
              <CardContent className="space-y-3 pt-1">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="size-9 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => {
            const Icon = stage.icon
            const active = activeStage === stage.id
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onStageChange(active ? null : stage.id)}
                className={cn(
                  "cursor-pointer rounded-xl border border-slate-100 bg-card/80 text-left shadow-sm backdrop-blur transition-all duration-300",
                  "hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800",
                  active && stage.activeTone
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground">{stage.label}</p>
                    <span className={cn("flex size-9 items-center justify-center rounded-lg", stage.tone)}>
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatNum(stage.value(metrics))}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
