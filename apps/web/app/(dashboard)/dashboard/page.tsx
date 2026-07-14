"use client"

import { DistributionPieChart, StatusBarChart, TrendAreaChart } from "@/components/charts"
import { KpiCard } from "@/components/shared/kpi-card"
import { EmptyState, LoadingGrid, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useDashboardSummary, useNotifications } from "@/hooks/use-api"
import { statusLabels } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { CheckCircle2, ClipboardList, FileCheck2, FileX2, Layers, Plus, TrendingUp } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")
  const canCreate = hasPermission("survey:create")
  const { data, isLoading, isError } = useDashboardSummary()
  const { data: notifications } = useNotifications(1)

  if (!canView) {
    return <EmptyState title="Dashboard unavailable" description="You do not have permission to view the dashboard." />
  }

  if (isLoading) return <LoadingGrid count={6} />
  if (isError || !data) {
    return <EmptyState title="Dashboard unavailable" description="Could not load summary metrics." />
  }

  const approved = data.byStatus.APPROVED ?? 0
  const submitted = data.pendingApproval ?? data.byStatus.SUBMITTED ?? 0
  const rejected = data.rejected ?? data.byStatus.REJECTED ?? 0
  const inProgress = (data.byStatus.IN_PROGRESS ?? 0) + (data.byStatus.DRAFT ?? 0) + (data.byStatus.REOPENED ?? 0)

  const statusChart = Object.entries(data.byStatus).map(([status, count]) => ({
    name: statusLabels[status] ?? status,
    value: count,
  }))

  const monthlyChart = (data.monthlyTrend ?? []).map((m) => ({
    name: m.month,
    value: m.count,
  }))

  const geoChart = (data.byUlb?.length ? data.byUlb : (data.byDistrict ?? [])).map((g) => ({
    name: g.name,
    value: g.count,
  }))

  const todayTotal = (data.today?.created ?? 0) + (data.today?.submitted ?? 0) + (data.today?.approved ?? 0)
  const todayProgress =
    data.total > 0 ? Math.min(100, Math.round(((data.today?.created ?? 0) / Math.max(data.total, 1)) * 1000)) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Executive overview of municipal property surveys in your tenant scope"
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/surveys/new">
                <Plus className="size-3.5" />
                New survey
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Total surveys" value={data.total} icon={Layers} />
        <KpiCard title="In progress" value={inProgress} icon={ClipboardList} />
        <KpiCard title="Pending QC" value={submitted} icon={TrendingUp} subtitle="Awaiting approval" />
        <KpiCard title="Approved" value={approved} icon={FileCheck2} />
        <KpiCard title="Rejected" value={rejected} icon={FileX2} />
        <KpiCard
          title="Today"
          value={data.today?.created ?? 0}
          icon={CheckCircle2}
          subtitle={`${data.today?.submitted ?? 0} submitted · ${data.today?.approved ?? 0} approved`}
        />
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Today&apos;s progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {data.today?.created ?? 0} created today
              {todayTotal ? ` · ${todayTotal} workflow events` : ""}
            </span>
            <span className="font-mono tabular-nums">{todayProgress}‰ of portfolio</span>
          </div>
          <Progress value={Math.min(100, todayProgress * 10)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly survey trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {monthlyChart.length ? (
              <TrendAreaChart data={monthlyChart} />
            ) : (
              <EmptyState title="No trend data yet" className="h-full border-0 py-8" />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {statusChart.length ? (
              <DistributionPieChart data={statusChart} />
            ) : (
              <EmptyState title="No status data" className="h-full border-0 py-8" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {data.byUlb?.length ? "ULB summary" : "District summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {geoChart.length ? (
              <StatusBarChart data={geoChart} />
            ) : (
              <EmptyState title="No geography data" className="h-full border-0 py-8" />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top surveyors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.topSurveyors ?? []).length ? (
              data.topSurveyors.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {i + 1}. {s.fullName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{s.email}</p>
                  </div>
                  <span className="font-mono text-sm tabular-nums">{s.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No surveyor activity yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ward summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.byWard ?? []).slice(0, 6).map((w) => (
                <div key={w.id} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{w.name}</span>
                  <span className="font-mono tabular-nums">{w.count}</span>
                </div>
              ))}
              {!data.byWard?.length ? <p className="text-sm text-muted-foreground">No ward data</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canCreate ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/surveys/new">Create survey</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/surveys?surveyStatus=SUBMITTED">Review pending QC</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/surveys?surveyStatus=REJECTED">View rejected</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">Open reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent surveys</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/surveys">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Property ID</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((survey) => (
                    <tr key={survey.id} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{survey.propertyId}</td>
                      <td className="py-2.5">
                        <StatusBadge status={survey.surveyStatus} />
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {new Date(survey.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/surveys/${survey.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.recent.length ? (
                <EmptyState
                  title="No surveys yet"
                  description="Create your first property survey to get started."
                  className="border-0 py-10"
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(notifications?.items ?? []).slice(0, 6).map((n) => (
              <Link
                key={n.id}
                href={`/surveys/${n.surveyId}`}
                className="block rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60"
              >
                <p className="line-clamp-2 text-sm">{n.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.changedAt).toLocaleString()}</p>
              </Link>
            ))}
            {!notifications?.items.length ? (
              <p className="text-sm text-muted-foreground">No recent notifications</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
