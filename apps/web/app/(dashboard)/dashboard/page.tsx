"use client"

import { DistributionPieChart, StatusBarChart, TrendAreaChart } from "@/components/charts"
import { KpiCard } from "@/components/shared/kpi-card"
import { EmptyState, LoadingGrid, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useDashboardSummary, useNotifications } from "@/hooks/use-api"
import { statusLabels } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  DraftingCompass,
  FileCheck2,
  FileX2,
  Gauge,
  Layers,
  Plus,
  Server,
  TrendingUp,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

interface ReadyChecks {
  database?: string
  redis?: string
  storage?: string
}

export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")
  const canCreate = hasPermission("survey:create")
  const canApprove = hasPermission("survey:approve")
  const { data, isLoading, isError } = useDashboardSummary()
  const { data: notifications } = useNotifications(1)
  const [health, setHealth] = useState<{ status: string; checks?: ReadyChecks } | null>(null)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    void fetch(`${base}/ready`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          status?: string
          checks?: ReadyChecks
          message?: { status?: string; checks?: ReadyChecks }
        } | null
        if (!response.ok) {
          const nested = body?.message ?? body
          setHealth({
            status: nested?.status ?? "not_ready",
            checks: nested?.checks,
          })
          return
        }
        setHealth({
          status: body?.status ?? "ready",
          checks: body?.checks,
        })
      })
      .catch(() => setHealth({ status: "unreachable" }))
  }, [])

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
  const draft = data.byStatus.DRAFT ?? 0
  const qcPending = data.qcStatus.PENDING ?? 0
  const qcApproved = data.qcStatus.APPROVED ?? 0
  const qcRejected = data.qcStatus.REJECTED ?? 0
  const surveyProgress = data.total > 0 ? Math.round((approved / data.total) * 100) : 0
  const qcProgress = data.total > 0 ? Math.round((qcApproved / data.total) * 100) : 0

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
  const activeImports = data.jobs.imports.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING").length
  const activeExports = data.jobs.exports.filter((job) => job.status === "QUEUED" || job.status === "PROCESSING").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Executive overview of municipal property surveys, QC throughput, and platform health"
        actions={
          <div className="flex flex-wrap gap-2">
            {canApprove ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/qc?pipeline=pending">Review QC</Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild size="sm">
                <Link href="/surveys/new">
                  <Plus className="size-3.5" />
                  New survey
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Total surveys" value={data.total} icon={Layers} />
        <KpiCard
          title="Today"
          value={data.today?.created ?? 0}
          icon={CheckCircle2}
          subtitle="Created since midnight UTC"
        />
        <KpiCard title="Pending QC" value={submitted} icon={TrendingUp} subtitle="Awaiting approval" />
        <KpiCard title="Approved" value={approved} icon={FileCheck2} />
        <KpiCard title="Rejected" value={rejected} icon={FileX2} />
        <KpiCard title="Draft" value={draft} icon={DraftingCompass} subtitle="Field work not submitted" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Survey progress</CardTitle>
            <CardDescription>
              {approved.toLocaleString()} approved of {data.total.toLocaleString()} total surveys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Approval completion</span>
              <span className="font-mono tabular-nums">{surveyProgress}%</span>
            </div>
            <Progress value={surveyProgress} />
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>{data.today?.created ?? 0} created today</span>
              <span>{data.today?.submitted ?? 0} submitted</span>
              <span>{data.today?.approved ?? 0} approved</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">QC progress</CardTitle>
            <CardDescription>Independent QC axis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">QC approved</span>
              <span className="font-mono tabular-nums">{qcProgress}%</span>
            </div>
            <Progress value={qcProgress} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{qcApproved} approved</span>
              <span>{qcPending} pending</span>
              <span>{qcRejected} rejected</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">GPS quality</CardTitle>
            <Gauge className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {data.gps.averageAccuracyMeters === null ? "—" : `${data.gps.averageAccuracyMeters.toFixed(1)} m`}
            </p>
            <p className="text-xs text-muted-foreground">Average accuracy across captured survey points</p>
            <p className="text-xs text-muted-foreground">{todayTotal} workflow events today</p>
          </CardContent>
        </Card>
      </div>

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
              {data.byUlb?.length ? "Municipality progress" : "District progress"}
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
            <CardTitle className="text-sm font-medium">Surveyor ranking</CardTitle>
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ward progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.byWard ?? []).slice(0, 8).map((w) => {
                const wardApproved = w.byStatus.APPROVED ?? 0
                const pct = w.count > 0 ? Math.round((wardApproved / w.count) * 100) : 0
                return (
                  <div key={w.id} className="space-y-1.5 rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="truncate font-medium">{w.name}</p>
                      <span className="font-mono tabular-nums">{w.count}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">
                      {wardApproved} approved · {w.byStatus.SUBMITTED ?? 0} pending · {pct}%
                    </p>
                  </div>
                )
              })}
              {!data.byWard?.length ? <p className="text-sm text-muted-foreground">No ward data</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System health</CardTitle>
            <CardDescription>API readiness probes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <HealthRow
              icon={Server}
              label="API"
              value={health?.status === "ready" ? "Ready" : (health?.status ?? "Checking…")}
              ok={health?.status === "ready"}
            />
            <HealthRow
              icon={Database}
              label="PostgreSQL"
              value={health?.checks?.database ?? "—"}
              ok={health?.checks?.database === "up"}
            />
            <HealthRow
              icon={Activity}
              label="Redis"
              value={health?.checks?.redis ?? "—"}
              ok={health?.checks?.redis === "up"}
            />
            <HealthRow
              icon={Upload}
              label="Object storage"
              value={health?.checks?.storage ?? "—"}
              ok={health?.checks?.storage === "up"}
            />
            <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
              Queue health · {activeImports} import / {activeExports} export jobs active
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
              <Link href="/surveys">Open registry</Link>
            </Button>
            {canApprove ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/qc?pipeline=pending">QC pending</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/reports">Report builder</Link>
            </Button>
            {canCreate ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/import">Import Excel</Link>
              </Button>
            ) : null}
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
                className="block cursor-pointer rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Import history</CardTitle>
            <Upload className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.jobs.imports.length ? (
              data.jobs.imports.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.originalName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {job.processedRows} / {job.totalRows} rows
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No import jobs in your recent activity.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Export history</CardTitle>
            <Download className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.jobs.exports.length ? (
              data.jobs.exports.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{job.reportType}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {job.format} · {job.rowCount} rows
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No export jobs in your recent activity.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HealthRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="size-3.5 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <Badge variant={ok ? "secondary" : "outline"} className="capitalize">
        {value}
      </Badge>
    </div>
  )
}
