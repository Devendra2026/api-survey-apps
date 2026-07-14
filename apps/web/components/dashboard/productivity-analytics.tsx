import { DualTrendAreaChart } from "@/components/charts"
import { SectionHeading } from "@/components/dashboard/section-heading"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatDashboardNumber, type SurveyorProductivity, type TrendPoint } from "@/lib/dashboard-mock"

export function ProductivityAnalytics({
  trend,
  surveyors,
}: {
  trend: TrendPoint[]
  surveyors: SurveyorProductivity[]
}) {
  const maxSubmitted = Math.max(...surveyors.map((s) => s.submitted), 1)

  return (
    <section>
      <SectionHeading title="Productivity Analytics" subtitle="30-day trends and team performance" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatCard hoverLift={false} className="flex min-h-80 flex-col">
          <div className="mb-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Daily Survey & Approval Trend</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Created, approved, and rejected over 30 days</p>
          </div>
          <div className="min-h-0 flex-1">
            <DualTrendAreaChart data={trend} />
          </div>
        </StatCard>

        <StatCard hoverLift={false} className="flex min-h-80 flex-col">
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Surveyor Productivity</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Top surveyors by completed volume</p>
          </div>
          <ul className="flex flex-1 flex-col gap-3.5">
            {surveyors.map((surveyor) => {
              const width = Math.round((surveyor.submitted / maxSubmitted) * 100)
              return (
                <li key={surveyor.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{surveyor.name}</p>
                    <p className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {formatDashboardNumber(surveyor.submitted)} submitted, {formatDashboardNumber(surveyor.approved)}{" "}
                      approved
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </StatCard>
      </div>
    </section>
  )
}
