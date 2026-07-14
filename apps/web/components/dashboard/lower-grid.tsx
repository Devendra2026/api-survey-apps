import { StatCard } from "@/components/dashboard/stat-card"
import {
  formatDashboardNumber,
  type ActivityItem,
  type MunicipalityPerf,
  type QcSupervisor,
} from "@/lib/dashboard-mock"
import { Badge } from "@workspace/ui/components/badge"
import { CheckCircle2, FileText } from "lucide-react"

const barAccent: Record<MunicipalityPerf["accent"], string> = {
  slate: "bg-slate-500",
  amber: "bg-amber-500",
  muted: "bg-slate-300 dark:bg-slate-700",
}

export function LowerGrid({
  supervisors,
  municipalities,
  activity,
}: {
  supervisors: QcSupervisor[]
  municipalities: MunicipalityPerf[]
  activity: ActivityItem[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard hoverLift={false} className="flex flex-col">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">QC Supervisor Throughput</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Leaderboard of verified logs</p>
        </div>
        <ul className="flex flex-col gap-3">
          {supervisors.length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-slate-400">No QC activity yet.</li>
          ) : (
            supervisors.map((row) => (
              <li
                key={row.name}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{row.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatDashboardNumber(row.approved)} approved · {formatDashboardNumber(row.rejected)} rejected
                  </p>
                </div>
                {row.status ? (
                  <Badge className="shrink-0 border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {row.status}
                  </Badge>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </StatCard>

      <StatCard hoverLift={false} className="flex flex-col">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Municipality Performance</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Approval share within each ULB</p>
        </div>
        <ul className="flex flex-col gap-4">
          {municipalities.length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-slate-400">No municipality data yet.</li>
          ) : (
            municipalities.map((ulb) => {
              const empty = ulb.target === 0 || ulb.percent === 0
              return (
                <li key={ulb.name} className={empty ? "opacity-60" : undefined}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{ulb.name}</p>
                    <p className="shrink-0 text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                      {ulb.percent}%
                    </p>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${barAccent[ulb.accent]}`}
                      style={{ width: `${Math.min(100, ulb.percent)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatDashboardNumber(ulb.approved)} / {formatDashboardNumber(ulb.target)}
                  </p>
                </li>
              )
            })
          )}
        </ul>
      </StatCard>

      <StatCard hoverLift={false} className="flex flex-col">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Recent Activity</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Recent survey and QC events</p>
        </div>
        <ul className="flex flex-col gap-3">
          {activity.length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-slate-400">No recent submissions.</li>
          ) : (
            activity.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <FileText className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium break-all text-slate-900 dark:text-slate-50">
                    {item.title}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item.actor}</span>
                    <span aria-hidden>·</span>
                    <span>{item.timestamp}</span>
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </StatCard>
    </div>
  )
}
