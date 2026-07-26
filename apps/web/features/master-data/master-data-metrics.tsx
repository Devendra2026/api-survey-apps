"use client"

import type { MasterDataTab } from "@/features/master-data/lib/tab-params"
import { cn } from "@workspace/ui/lib/utils"
import { Building2, Database, Layers, MapPin, type LucideIcon } from "lucide-react"

type Metric = {
  label: string
  value: string | number
  hint: string
  icon: LucideIcon
  tone: "warning" | "info" | "success" | "muted" | "ai"
}

const toneClass: Record<Metric["tone"], string> = {
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
  ai: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
}

export function MasterDataMetrics({
  activeTab,
  categories,
  districts,
  ulbs,
  wards,
}: {
  activeTab: MasterDataTab
  categories: number
  districts: number | null
  ulbs: number | null
  wards: number | null
}) {
  const metrics: Metric[] =
    activeTab === "reference"
      ? [
          { label: "Categories", value: categories, hint: "Survey dropdown fields", icon: Layers, tone: "warning" },
          { label: "Reference Data", value: "Live", hint: "Syncs to open forms", icon: Database, tone: "info" },
          {
            label: "Districts",
            value: districts ?? "—",
            hint: "Geographic hierarchy",
            icon: MapPin,
            tone: "success",
          },
          {
            label: "ULBs",
            value: ulbs ?? "—",
            hint: "Wards load per ULB on demand",
            icon: Building2,
            tone: "ai",
          },
        ]
      : [
          {
            label: "Districts",
            value: districts ?? "—",
            hint: "Top-level geography",
            icon: MapPin,
            tone: "info",
          },
          {
            label: "ULBs",
            value: ulbs ?? "—",
            hint: "Municipal councils & town panchayats",
            icon: Building2,
            tone: "success",
          },
          {
            label: "Wards",
            value: wards && wards > 0 ? wards : "On demand",
            hint: "Loaded when a ULB is expanded",
            icon: Layers,
            tone: "warning",
          },
          {
            label: "Categories",
            value: categories,
            hint: "Reference dropdown fields",
            icon: Database,
            tone: "muted",
          },
        ]

  return (
    <section aria-labelledby="masters-kpi-heading" className="space-y-3">
      <div>
        <h2 id="masters-kpi-heading" className="text-sm font-semibold text-foreground">
          Master Data Metrics
        </h2>
        <p className="text-xs text-muted-foreground">
          {activeTab === "reference" ? "Reference values and geographic coverage" : "Tenant hierarchy overview"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
          >
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", toneClass[m.tone])}>
              <m.icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
              <p className="truncate text-xl font-semibold tracking-tight text-foreground tabular-nums">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
