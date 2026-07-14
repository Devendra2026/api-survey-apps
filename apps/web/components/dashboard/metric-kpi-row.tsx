import { StatCard } from "@/components/dashboard/stat-card"
import { formatDashboardNumber, type DashboardKpi } from "@/lib/dashboard-mock"
import type { LucideIcon } from "lucide-react"
import { Calendar, CheckCircle2, ClipboardList, Clock, FileText } from "lucide-react"

const iconMap: Record<DashboardKpi["icon"], LucideIcon> = {
  clipboard: ClipboardList,
  fileText: FileText,
  clock: Clock,
  calendar: Calendar,
  checkCircle: CheckCircle2,
}

const toneStyles: Record<DashboardKpi["tone"], { iconWrap: string; value?: string }> = {
  slate: { iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  gray: { iconWrap: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  amber: {
    iconWrap: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
  },
  blue: { iconWrap: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" },
  emerald: {
    iconWrap: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-400",
  },
}

export function MetricKpiRow({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.icon]
        const tone = toneStyles[kpi.tone]
        return (
          <StatCard key={kpi.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <span className={`flex size-9 items-center justify-center rounded-lg ${tone.iconWrap}`}>
                <Icon className="size-4" />
              </span>
            </div>
            <div>
              <p
                className={`text-2xl font-bold tracking-tight tabular-nums ${tone.value ?? "text-slate-900 dark:text-slate-50"}`}
              >
                {formatDashboardNumber(kpi.value)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kpi.subtext}</p>
            </div>
          </StatCard>
        )
      })}
    </div>
  )
}
